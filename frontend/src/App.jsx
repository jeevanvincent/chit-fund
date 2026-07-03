import React, { useState, useEffect } from 'react';

const API_BASE = "http://localhost:5000/api";

export default function App() {
  // Authentication & View States
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Input Field States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard Metrics States
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState('1');
  const [choice1, setChoice1] = useState('');
  const [choice2, setChoice2] = useState('');

  // Helper: Fetch user's latest ledger and slot status from backend
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

  // Accessibility Audio Feature for Low Literacy Contexts
  const triggerVoiceAssist = () => {
    if (!dashboardData?.latestBill) return;
    const voiceMsg = `Hello ${user.full_name}, your current payment due is ${dashboardData.latestBill.net_amount_payable} rupees. Status is ${dashboardData.latestBill.status}.`;
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

  // Action: Handle booking a preferred month using FIFO logic
  const handleSlotAllocation = async (e) => {
    e.preventDefault();
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
        fetchDashboardMetrics(user.id);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Action: Simulated direct payment clearing flow
  const processPaymentUpdate = async () => {
    if (!dashboardData?.latestBill) return;
    try {
      const res = await fetch(`${API_BASE}/payment/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerId: dashboardData.latestBill.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardMetrics(user.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

 // =======================================================
  // VIEW A: AUTHENTICATION INTERFACE (With Smooth Transitions)
  // =======================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white flex items-center justify-center p-4 font-sans pattern-isometric">
        
        {/* Animated Main Card: Subtle scale-in and fade on load */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl transition-all duration-500 transform hover:shadow-emerald-500/10 hover:border-white/30 tracking-normal motion-safe:animate-[fadeIn_0.5s_ease-out]">
          
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
      </div>
    );
  }
  // =======================================================
  // VIEW B: MAIN MEMBER ACCESSIBLE INTERACTIVE DASHBOARD
  // =======================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white font-sans p-4 flex flex-col items-center">
      
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
          <button onClick={() => { setUser(null); setDashboardData(null); }} className="text-xs bg-red-500/20 text-red-200 border border-red-500/30 px-3 py-2 rounded-xl font-bold transition hover:bg-red-500/40">Exit</button>
        </div>
      </nav>

      <main className="w-full max-w-md space-y-4">

        {/* CONDITION 1: User hasn't pre-booked a payout month slot yet */}
        {!dashboardData?.allocation ? (
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black mb-1 text-amber-300">Lock Your Payout Slots</h2>
            <p className="text-xs text-emerald-200 mb-4">Select your group allocation profile preference targets. System manages overlaps automatically via FIFO timestamps.</p>
            
            <form onSubmit={handleSlotAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-100 uppercase mb-1">Chit Scheme Group (Max 5 Options)</label>
                <select value={selectedScheme} onChange={(e) => setSelectedScheme(e.target.value)} className="w-full p-4 bg-slate-950 text-white border border-white/10 rounded-xl font-bold">
                  <option value="1">Gold Group Alpha (₹1,00,000 Plan)</option>
                  <option value="2">Silver Group Beta (₹50,000 Plan)</option>
                  <option value="3">Diamond Elite (₹5,00,000 Plan)</option>
                  <option value="4">Micro Savings Plan (₹20,000 Plan)</option>
                  <option value="5">Business Growth Fund (₹2,00,000 Plan)</option>
                </select>
              </div>
              
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
        ) : (
          /* CONDITION 2: User has choices allocated. Display live billing status cards */
          <>
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-1 rounded-full uppercase">
                {dashboardData.allocation.scheme_name}
              </span>
              <h1 className="text-lg font-bold text-white mt-4">Current Monthly Account Dues</h1>
              
              <div className="my-4 flex items-baseline gap-1">
                <span className="text-5xl font-black tracking-tight text-white">
                  ₹{dashboardData.latestBill ? dashboardData.latestBill.net_amount_payable : "5000"}
                </span>
                <span className="text-emerald-300 text-xs font-medium">
                  for Month {dashboardData.allocation.current_month}/{dashboardData.allocation.total_slots}
                </span>
              </div>

              {dashboardData.latestBill?.status === 'Pending' ? (
                <button 
                  onClick={processPaymentUpdate}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xl rounded-2xl shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition uppercase tracking-wider"
                >
                  Pay Installment Now
                </button>
              ) : (
                <div className="w-full py-4 bg-emerald-600 text-white font-bold text-center text-xl rounded-2xl shadow-inner">
                  ✓ Month Payment Cleared
                </div>
              )}
            </div>

            {/* FIFO Allocation Proof Ledger Confirmation Badge Block */}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl">
              <h3 className="font-bold text-sm text-amber-400 mb-1">🔒 Allocation Lock Secured</h3>
              <p className="text-xs text-emerald-100">The software queue engine evaluated your preferences using the FIFO rule:</p>
              <div className="mt-3 p-4 bg-slate-950/40 border border-emerald-500/30 rounded-xl text-center">
                <span className="text-xs text-emerald-400 font-semibold block">Your Guaranteed Payout Window</span>
                <span className="text-3xl font-black text-white">Month {dashboardData.allocation.allocated_month}</span>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}