import React, { useState, useEffect } from 'react';

const API_BASE = "http://localhost:5000/api";

// Static catalog describing every chit scheme on offer, used for the browse
// / join UI. Once a member actually joins one, the real numbers (total_value,
// total_slots, etc.) come back from the backend as part of that membership.
const SCHEMES_CATALOG = [
  { id: '1', name: 'Gold Group Alpha', value: '₹1,00,000', tagline: 'High-value, long-term wealth circle', accent: 'from-amber-300 to-yellow-600', icon: '🥇' },
  { id: '2', name: 'Silver Group Beta', value: '₹50,000', tagline: 'Balanced, mid-size savings group', accent: 'from-slate-200 to-slate-400', icon: '🥈' },
  { id: '3', name: 'Diamond Elite', value: '₹5,00,000', tagline: 'Premium circle for large-scale goals', accent: 'from-cyan-200 to-blue-500', icon: '💎' },
  { id: '4', name: 'Micro Savings Plan', value: '₹20,000', tagline: 'Easy entry, small monthly commitment', accent: 'from-emerald-300 to-green-500', icon: '🌱' },
  { id: '5', name: 'Business Growth Fund', value: '₹2,00,000', tagline: 'Built for entrepreneurs & working capital', accent: 'from-purple-300 to-fuchsia-500', icon: '📈' },
];

export default function App() {
  // Authentication & View States
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Input Field States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard state. dashboardData.memberships is an array — a member can
  // now hold several scheme memberships at once, each with its own full
  // payment ledger (every month billed so far).
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState('1');
  const [choice1, setChoice1] = useState('');
  const [choice2, setChoice2] = useState('');
  const [joinError, setJoinError] = useState('');
  const [payingId, setPayingId] = useState(null); // ledger id currently being paid, for a small loading state

  // Which section of the main dashboard is visible: 'home' | 'schemes' | 'history'
  const [activeTab, setActiveTab] = useState('home');

  // Helper: Fetch every membership + ledger the member has from the backend
  const fetchDashboardMetrics = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/member/${userId}/dashboard`);
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  };

  // Sync dashboard parameters whenever a user successfully logs in
  useEffect(() => {
    if (user) {
      fetchDashboardMetrics(user.id);
    }
  }, [user]);

  const memberships = dashboardData?.memberships || [];
  const joinedSchemeNames = new Set(memberships.map((m) => m.allocation.scheme_name));

  // The bill a member should act on for a given membership: the earliest
  // Pending row if one exists, otherwise the most recent row (fully paid out).
  const getActiveBill = (membership) => {
    const pending = membership.ledger.find((row) => row.status === 'Pending');
    if (pending) return pending;
    return membership.ledger[membership.ledger.length - 1] || null;
  };

  // Build a month-by-month status timeline (Paid / Due / Upcoming) for one
  // membership, using its REAL ledger rows instead of guessing — months with
  // no ledger row yet (because they haven't come around in the billing cycle)
  // are shown as upcoming.
  const buildMonthsTimeline = (membership) => {
    const totalMonths = membership.allocation.total_slots || 20;
    const byMonth = {};
    membership.ledger.forEach((row) => { byMonth[row.month_number] = row.status; });
    const months = [];
    for (let m = 1; m <= totalMonths; m++) {
      let status = 'upcoming';
      if (byMonth[m] === 'Paid') status = 'paid';
      else if (byMonth[m] === 'Pending') status = 'due';
      months.push({ month: m, status });
    }
    return months;
  };

  // Accessibility Audio Feature for Low Literacy Contexts — reads out the
  // first membership that currently has money due.
  const triggerVoiceAssist = () => {
    const dueMembership = memberships.find((m) => getActiveBill(m)?.status === 'Pending');
    if (!dueMembership) return;
    const bill = getActiveBill(dueMembership);
    const voiceMsg = `Hello ${user.full_name}, your ${dueMembership.allocation.scheme_name} payment due is ${bill.net_amount_payable} rupees for month ${bill.month_number}.`;
    const utterance = new SpeechSynthesisUtterance(voiceMsg);
    utterance.lang = 'en-IN'; 
    window.speechSynthesis.speak(utterance);
  };

  // Action: Handle logging in an existing user
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        setLoginError(data.message || 'Invalid phone or secret PIN.');
      }
    } catch (err) {
      setLoginError('Cannot connect to the backend server. Make sure it is turned on.');
    }
  };

  // Action: Handle registering a brand-new user account
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, password })
      });
      const data = await res.json();
      if (data.success) {
        alert("Account Created Safely!");
        setUser(data.user); // Automatically log them in to the dashboard
      } else {
        setLoginError(data.message || 'Registration failed.');
      }
    } catch (err) {
      setLoginError('Server connectivity issue. Registration timed out.');
    }
  };

  // Action: Handle booking a preferred month using FIFO logic. A member can
  // do this once per scheme — joining a second, third, etc. scheme is fine,
  // but the same scheme twice is blocked (the backend also enforces this).
  const handleSlotAllocation = async (e) => {
    e.preventDefault();
    setJoinError('');

    const targetScheme = SCHEMES_CATALOG.find((s) => s.id === selectedScheme);
    if (targetScheme && joinedSchemeNames.has(targetScheme.name)) {
      setJoinError("You've already joined this scheme — pick a different one.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/allocation/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: user.id,
          schemeId: selectedScheme,
          choice1: parseInt(choice1),
          choice2: parseInt(choice2)
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Success! FIFO rule queue secured your payout in Month ${data.allocatedMonth}`);
        setChoice1('');
        setChoice2('');
        fetchDashboardMetrics(user.id);
        setActiveTab('home');
      } else {
        setJoinError(data.message);
      }
    } catch (err) {
      console.error(err);
      setJoinError('Could not reach the server. Please try again.');
    }
  };

  // Action: Pay a specific membership's currently due month. On success the
  // backend automatically opens next month's bill for that same scheme, so
  // refreshing the dashboard is enough to reveal it.
  const processPaymentUpdate = async (ledgerId) => {
    if (!ledgerId) return;
    setPayingId(ledgerId);
    try {
      const res = await fetch(`${API_BASE}/payment/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerId })
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardMetrics(user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPayingId(null);
    }
  };

 // =======================================================
  // VIEW A: AUTHENTICATION INTERFACE (With Smooth Transitions)
  // =======================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white flex items-center justify-center p-4 font-sans pattern-isometric">
        
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4">

        {/* Animated Main Card: Subtle scale-in and fade on load */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl transition-all duration-500 transform hover:shadow-emerald-500/10 hover:border-white/30 tracking-normal motion-safe:animate-[fadeIn_0.5s_ease-out] md:order-1">
          
          <div className="text-center mb-6">
            {/* Pulsing Icon Badge */}
            <div className="w-16 h-16 bg-amber-400 rounded-full mx-auto flex items-center justify-center shadow-lg mb-2 transition-transform duration-300 hover:scale-110 cursor-pointer group">
              <span className="text-slate-900 text-3xl font-black group-hover:rotate-12 transition-transform">₹</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Chit Fund System</h1>
            <p className="text-emerald-300 text-xs mt-1 transition-all duration-300">
              {isRegistering ? "Create your secure subscriber account" : "Simple & Safe Digital Platform"}
            </p>
          </div>

          {loginError && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs p-3 rounded-xl mb-4 text-center font-bold animate-bounce">
              {loginError}
            </div>
          )}

          {/* Dynamic Forms with Smooth Opacity Cross-fades */}
          <div className="transition-all duration-300 ease-in-out">
            {isRegistering ? (
              /* 📝 REGISTER FORM INTERFACE */
              <form onSubmit={handleRegister} className="space-y-4 motion-safe:animate-[fadeIn_0.3s_ease-in-out]">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Full Name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Enter full name" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-lg transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Mobile Number</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Enter mobile number" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-lg transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Create Secret PIN / Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-lg transition-all" />
                </div>
                
                <button type="submit" className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-black text-xl rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 tracking-wide uppercase mt-2">
                  Register & Sign Up
                </button>
                
                <p className="text-center text-xs text-emerald-200 mt-4">
                  Already have an account?{" "}
                  <button type="button" onClick={() => { setIsRegistering(false); setLoginError(''); }} className="text-amber-300 underline font-bold hover:text-amber-200 transition-colors">Log In</button>
                </p>
              </form>
            ) : (
              /* 🔑 LOGIN FORM INTERFACE */
              <form onSubmit={handleLogin} className="space-y-4 motion-safe:animate-[fadeIn_0.3s_ease-in-out]">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Mobile Number</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Enter mobile number" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-lg transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Secret PIN / Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-lg transition-all" />
                </div>
                
                <button type="submit" className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-black text-xl rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 tracking-wide uppercase mt-2">
                  Open Dashboard
                </button>
                
                <p className="text-center text-xs text-emerald-200 mt-4">
                  New to the platform?{" "}
                  <button type="button" onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-amber-300 underline font-bold hover:text-amber-200 transition-colors">Create Account</button>
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Animated coin panel: hover/point to trigger the coin jump + flying money */}
        <div className="w-full max-w-xs md:max-w-sm flex flex-col items-center justify-center md:order-2 select-none">
          <div className="group relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center cursor-pointer">

            {/* Flying money symbols — hidden until the panel is hovered */}
            <span style={{ '--fx': '-70px', '--fr': '-20deg' }} className="pointer-events-none absolute top-1/2 left-1/2 text-3xl opacity-0 group-hover:opacity-100 group-hover:animate-[moneyFly_1.4s_ease-out_infinite] [animation-delay:0s]">₹</span>
            <span style={{ '--fx': '60px', '--fr': '18deg' }} className="pointer-events-none absolute top-1/2 left-1/2 text-2xl opacity-0 group-hover:opacity-100 group-hover:animate-[moneyFly_1.6s_ease-out_infinite] [animation-delay:0.2s]">💵</span>
            <span style={{ '--fx': '-30px', '--fr': '10deg' }} className="pointer-events-none absolute top-1/2 left-1/2 text-2xl opacity-0 group-hover:opacity-100 group-hover:animate-[moneyFly_1.5s_ease-out_infinite] [animation-delay:0.4s]">₹</span>
            <span style={{ '--fx': '90px', '--fr': '-15deg' }} className="pointer-events-none absolute top-1/2 left-1/2 text-xl opacity-0 group-hover:opacity-100 group-hover:animate-[moneyFly_1.3s_ease-out_infinite] [animation-delay:0.55s]">💰</span>
            <span style={{ '--fx': '10px', '--fr': '25deg' }} className="pointer-events-none absolute top-1/2 left-1/2 text-2xl opacity-0 group-hover:opacity-100 group-hover:animate-[moneyFly_1.7s_ease-out_infinite] [animation-delay:0.7s]">₹</span>

            {/* Ground shadow beneath the coin, pulses opposite the jump */}
            <div className="absolute bottom-6 w-32 h-6 bg-black/40 rounded-full blur-md group-hover:animate-[coinShadow_0.8s_ease-in-out_infinite]"></div>

            {/* The coin itself */}
            <div className="text-[130px] md:text-[150px] leading-none drop-shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition-transform duration-300 group-hover:animate-[coinJump_0.8s_ease-in-out_infinite]">
              🪙
            </div>
          </div>
          <p className="text-emerald-200/80 text-xs font-medium mt-2 text-center">
            Point at the coin — watch your savings take flight
          </p>
        </div>

        </div>
      </div>
    );
  }
  // =======================================================
  // VIEW B: MAIN MEMBER ACCESSIBLE INTERACTIVE DASHBOARD
  // =======================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white font-sans p-4 flex flex-col items-center pb-28">
      
      {/* Universal Sticky Glassmorphic Navbar Component */}
      <nav className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-lg mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-black text-xl">
            {user.full_name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">{user.full_name}</h2>
            <span className="text-[10px] text-emerald-300 font-medium flex items-center gap-1">✓ Active Account Verified</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={triggerVoiceAssist} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 text-xs font-bold transition">
            🔊 Speak
          </button>
          <button onClick={() => { setUser(null); setDashboardData(null); setActiveTab('home'); }} className="text-xs bg-red-500/20 text-red-200 border border-red-500/30 px-3 py-2 rounded-xl font-bold transition hover:bg-red-500/40">Exit</button>
        </div>
      </nav>

      <main className="w-full max-w-md space-y-4">

        {/* ============================= HOME TAB ============================= */}
        {activeTab === 'home' && (
          memberships.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl text-center">
              <div className="text-5xl mb-3">👋</div>
              <h2 className="text-xl font-black mb-1 text-amber-300">Welcome, {user.full_name.split(' ')[0]}!</h2>
              <p className="text-xs text-emerald-200 mb-4">You haven't joined a chit scheme yet. Head to the Schemes tab to pick a group and lock your payout slot.</p>
              <button onClick={() => setActiveTab('schemes')} className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg rounded-2xl shadow-xl uppercase transition tracking-wider">
                Browse Schemes
              </button>
            </div>
          ) : (
            <>
              {memberships.map((membership) => {
                const bill = getActiveBill(membership);
                const isPending = bill?.status === 'Pending';
                const isComplete = bill?.status === 'Paid' && bill.month_number === (membership.allocation.total_slots || 20);
                const paidCount = membership.ledger.filter((r) => r.status === 'Paid').length;
                const totalMonths = membership.allocation.total_slots || 20;

                return (
                  <div key={membership.allocation.id} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl">
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-1 rounded-full uppercase">
                      {membership.allocation.scheme_name}
                    </span>
                    <h1 className="text-lg font-bold text-white mt-4">
                      {isComplete ? "Scheme Fully Paid Out 🎉" : "Current Monthly Account Dues"}
                    </h1>

                    {bill && (
                      <div className="my-4 flex items-baseline gap-1">
                        <span className="text-5xl font-black tracking-tight text-white">
                          ₹{Math.round(bill.net_amount_payable)}
                        </span>
                        <span className="text-emerald-300 text-xs font-medium">
                          for Month {bill.month_number}/{totalMonths}
                        </span>
                      </div>
                    )}

                    {isPending ? (
                      <button
                        onClick={() => processPaymentUpdate(bill.id)}
                        disabled={payingId === bill.id}
                        className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-black text-xl rounded-2xl shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition uppercase tracking-wider"
                      >
                        {payingId === bill.id ? 'Processing…' : `Pay Month ${bill.month_number} Now`}
                      </button>
                    ) : (
                      <div className="w-full py-4 bg-emerald-600 text-white font-bold text-center text-xl rounded-2xl shadow-inner">
                        {isComplete ? '✓ All Months Cleared' : '✓ Month Payment Cleared'}
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="w-full h-2.5 bg-slate-950/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                          style={{ width: `${(paidCount / totalMonths) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-[11px] text-emerald-200 mt-2">{paidCount} of {totalMonths} months paid · Payout secured for Month {membership.allocation.allocated_month}</p>
                    </div>
                  </div>
                );
              })}

              <button onClick={() => setActiveTab('schemes')} className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-amber-300 font-bold text-sm rounded-2xl transition uppercase tracking-wide">
                + Join Another Scheme
              </button>
            </>
          )
        )}

        {/* ============================= SCHEMES TAB ============================= */}
        {activeTab === 'schemes' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-xl font-black mb-1 text-amber-300">
                {memberships.length > 0 ? 'Join Another Scheme' : 'Lock Your Payout Slot'}
              </h2>
              <p className="text-xs text-emerald-200 mb-1">Tap a scheme to select it — it'll glow gold once chosen. You can join as many schemes as you like, one at a time.</p>
              <p className="text-xs text-emerald-200">The queue engine manages overlaps automatically via FIFO timestamps.</p>
            </div>

            {/* Scheme cards: each scheme gets its own box, glowing on hover/selection */}
            <div className="grid grid-cols-1 gap-3">
              {SCHEMES_CATALOG.map((scheme) => {
                const isJoined = joinedSchemeNames.has(scheme.name);
                const isSelected = !isJoined && selectedScheme === scheme.id;

                return (
                  <button
                    key={scheme.id}
                    type="button"
                    disabled={isJoined}
                    onClick={() => { setSelectedScheme(scheme.id); setJoinError(''); }}
                    className={`text-left p-4 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4
                      ${isJoined ? 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_25px_rgba(52,211,153,0.4)] cursor-not-allowed' : ''}
                      ${isSelected ? 'border-amber-400 bg-amber-400/10 motion-safe:animate-[glowPulse_1.8s_ease-in-out_infinite]' : ''}
                      ${!isJoined && !isSelected ? 'border-white/10 bg-slate-950/40 hover:border-amber-400/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer' : ''}
                    `}
                  >
                    <div className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${scheme.accent} flex items-center justify-center text-2xl shadow-inner`}>
                      {scheme.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-white text-sm">{scheme.name}</h3>
                        {isJoined && <span className="text-[9px] bg-emerald-500/30 text-emerald-200 font-bold px-2 py-0.5 rounded-full uppercase">Joined</span>}
                      </div>
                      <p className="text-amber-300 font-bold text-sm">{scheme.value} Plan</p>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5">{scheme.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {joinError && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs p-3 rounded-xl text-center font-bold">
                {joinError}
              </div>
            )}

            <form onSubmit={handleSlotAllocation} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-100 uppercase mb-1">Choice 1 (Month)</label>
                  <input type="number" min="1" max="20" placeholder="e.g. 5" value={choice1} onChange={(e) => setChoice1(e.target.value)} required className="w-full p-4 bg-slate-950 border border-white/10 rounded-xl text-center font-black text-xl focus:border-amber-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-100 uppercase mb-1">Choice 2 (Month)</label>
                  <input type="number" min="1" max="20" placeholder="e.g. 8" value={choice2} onChange={(e) => setChoice2(e.target.value)} required className="w-full p-4 bg-slate-950 border border-white/10 rounded-xl text-center font-black text-xl focus:border-amber-400 focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg rounded-2xl shadow-xl uppercase transition tracking-wider">
                Confirm Allocation Priority
              </button>
            </form>
          </div>
        )}

        {/* ============================= HISTORY TAB ============================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {memberships.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl text-center">
                <div className="text-4xl mb-2">🧾</div>
                <h2 className="text-lg font-black text-amber-300 mb-1">No History Yet</h2>
                <p className="text-xs text-emerald-200">Join a scheme first — your monthly payment record will show up here.</p>
              </div>
            ) : (
              memberships.map((membership) => {
                const bill = getActiveBill(membership);
                const monthsTimeline = buildMonthsTimeline(membership);
                const totalMonths = membership.allocation.total_slots || 20;

                return (
                  <div key={membership.allocation.id} className="space-y-3">
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-5 shadow-2xl">
                      <h2 className="text-lg font-black text-amber-300 mb-1">{membership.allocation.scheme_name}</h2>
                      <p className="text-xs text-emerald-200">Payout secured for Month {membership.allocation.allocated_month} · Every month is billed as it comes due, so future months only appear once they're active.</p>
                    </div>

                    {bill && (
                      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl flex justify-between items-center">
                        <div>
                          <p className="text-[11px] text-emerald-200 uppercase font-bold">Current / Latest Entry</p>
                          <p className="text-2xl font-black text-white">₹{Math.round(bill.net_amount_payable)}</p>
                          <p className="text-[11px] text-emerald-300">Month {bill.month_number}</p>
                        </div>
                        <span className={`text-xs font-black px-3 py-2 rounded-xl uppercase ${bill.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'}`}>
                          {bill.status}
                        </span>
                      </div>
                    )}

                    <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl">
                      <h3 className="font-bold text-sm text-emerald-100 mb-3">All {totalMonths} Months</h3>
                      <div className="grid grid-cols-5 gap-2">
                        {monthsTimeline.map(({ month, status }) => (
                          <div
                            key={month}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center border text-[11px] font-black
                              ${status === 'paid' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' : ''}
                              ${status === 'due' ? 'bg-amber-400/20 border-amber-400/50 text-amber-200 motion-safe:animate-pulse' : ''}
                              ${status === 'upcoming' ? 'bg-slate-950/40 border-white/10 text-emerald-200/40' : ''}
                            `}
                          >
                            <span>{month}</span>
                            <span className="text-[9px]">{status === 'paid' ? '✓' : status === 'due' ? '⏳' : ''}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-4 text-[10px] text-emerald-200">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block"></span> Paid</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400/50 inline-block"></span> Due</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block"></span> Upcoming</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </main>

      {/* Fixed bottom tab bar */}
      <div className="fixed bottom-4 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl flex justify-around p-2">
          {[
            { key: 'home', label: 'Home', icon: '🏠' },
            { key: 'schemes', label: 'Schemes', icon: '📜' },
            { key: 'history', label: 'History', icon: '🧾' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl font-bold text-[11px] transition-all
                ${activeTab === tab.key ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-emerald-200 hover:bg-white/10'}
              `}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}