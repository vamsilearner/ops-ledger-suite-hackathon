import React, { useState, useEffect } from "react";
import {
  Receipt,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  Database,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  KeyRound,
  LogOut,
  Sliders,
  Copy,
  Terminal,
  Cloud,
  CloudOff,
  User,
  ShieldAlert,
  ServerCrash,
  Lock
} from "lucide-react";
import { supabase } from "./lib/supabase";

interface LedgerItem {
  id: string;
  vendor: string;
  amount: number;
  category: "Logistics" | "Marketing" | "Software" | "Office Supplies";
  invoice_date: string;
  created_at: string;
}

export default function App() {
  // Authentication State
  const [user, setUser] = useState<any | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Input & Processing State
  const [rawText, setRawText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted intermediate state (Editable before confirming)
  const [extractedData, setExtractedData] = useState<{
    vendor: string;
    amount: number;
    category: "Logistics" | "Marketing" | "Software" | "Office Supplies";
    invoice_date: string;
  } | null>(null);

  // Ledger main state array
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  
  // Database State configuration
  const [useSupabaseDB, setUseSupabaseDB] = useState<boolean>(false);
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [dbLoading, setDbLoading] = useState<boolean>(false);

  // Track Auth state
  useEffect(() => {
    // Get current user session
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        setUseSupabaseDB(true);
      }
    });

    // Monitor Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setUseSupabaseDB(true);
      } else {
        setUseSupabaseDB(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch or trigger fallback
  useEffect(() => {
    if (useSupabaseDB && user) {
      fetchLedgerFromSupabase();
    } else {
      // Load offline presets & localStorage
      loadLocalStorageLedger();
    }
  }, [useSupabaseDB, user]);

  // Read transactions from Supabase
  const fetchLedgerFromSupabase = async () => {
    setDbLoading(true);
    setSupabaseErrorMsg(null);
    try {
      const { data, error: dbError } = await supabase
        .from("ledger")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbError) {
        throw dbError;
      }

      if (data) {
        setLedger(data);
      }
    } catch (err: any) {
      console.error("Supabase ledger read error:", err);
      // If table doesnt exist, we instruct Neha how to easily create it
      if (err.message && (err.message.includes("relation") || err.message.includes("does not exist"))) {
        setSupabaseErrorMsg("ledger_table_missing");
      } else {
        setSupabaseErrorMsg(err.message || "Failed to query the live Supabase storage.");
      }
      // Revert into offline localstorage fallback seamlessly so application continues working!
      loadLocalStorageLedger();
    } finally {
      setDbLoading(false);
    }
  };

  // Local storage fallback loader
  const loadLocalStorageLedger = () => {
    setSupabaseErrorMsg(null);
    const saved = localStorage.getItem("nep_ops_ledger");
    if (saved) {
      try {
        setLedger(JSON.parse(saved));
      } catch (e) {
        console.error("Localstorage parse error", e);
      }
    } else {
      // Fresh demo dataset
      const initialLedger: LedgerItem[] = [
        {
          id: "led-1",
          vendor: "Stripe Gateway Inc",
          amount: 1420.50,
          category: "Software",
          invoice_date: "2026-06-15",
          created_at: new Date().toISOString()
        },
        {
          id: "led-2",
          vendor: "FedEx Freight Shipping",
          amount: 890.00,
          category: "Logistics",
          invoice_date: "2026-06-12",
          created_at: new Date().toISOString()
        },
        {
          id: "led-3",
          vendor: "Meta Advertising Ops",
          amount: 3200.00,
          category: "Marketing",
          invoice_date: "2026-06-10",
          created_at: new Date().toISOString()
        },
        {
          id: "led-4",
          vendor: "Paper & Co Suppliers",
          amount: 215.15,
          category: "Office Supplies",
          invoice_date: "2026-06-08",
          created_at: new Date().toISOString()
        }
      ];
      setLedger(initialLedger);
      localStorage.setItem("nep_ops_ledger", JSON.stringify(initialLedger));
    }
  };

  // Sync state mutation helper
  const syncLedgerMutation = async (newItem: LedgerItem, action: "insert" | "delete") => {
    if (useSupabaseDB && user) {
      try {
        if (action === "insert") {
          // If the user is logged in, insert to live Supabase DB
          const { error: dbError } = await supabase
            .from("ledger")
            .insert([
              {
                id: newItem.id,
                vendor: newItem.vendor,
                amount: newItem.amount,
                category: newItem.category,
                invoice_date: newItem.invoice_date,
                user_id: user.id
              }
            ]);
          if (dbError) throw dbError;
          // Optimistic local state load representation
          setLedger([newItem, ...ledger]);
        } else if (action === "delete") {
          const { error: dbError } = await supabase
            .from("ledger")
            .delete()
            .eq("id", newItem.id);
          if (dbError) throw dbError;
          setLedger(ledger.filter((item) => item.id !== newItem.id));
        }
      } catch (err: any) {
        console.error("Mutation sync issue:", err);
        alert(`Supabase Sync failed: ${err.message}. Saving changes locally instead.`);
        // Fallback local storage fallback behavior
        mutateLocalStorage(newItem, action);
      }
    } else {
      mutateLocalStorage(newItem, action);
    }
  };

  const mutateLocalStorage = (item: LedgerItem, action: "insert" | "delete") => {
    let updated: LedgerItem[] = [];
    if (action === "insert") {
      updated = [item, ...ledger];
    } else {
      updated = ledger.filter((li) => li.id !== item.id);
    }
    setLedger(updated);
    localStorage.setItem("nep_ops_ledger", JSON.stringify(updated));
  };

  // Parse Document Handler
  const handleParseDocument = async () => {
    if (!rawText.trim()) {
      setError("Please input or paste raw receipt text first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const response = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process the receipt text.");
      }

      const data = await response.json();
      
      let categoryVal: "Logistics" | "Marketing" | "Software" | "Office Supplies" = "Software";
      const cleanCat = String(data.category).trim();
      if (["Logistics", "Marketing", "Software", "Office Supplies"].includes(cleanCat)) {
        categoryVal = cleanCat as any;
      } else {
        // Safe mapping values
        if (cleanCat.toLowerCase().includes("ship") || cleanCat.toLowerCase().includes("delivery") || cleanCat.toLowerCase().includes("logistics")) {
          categoryVal = "Logistics";
        } else if (cleanCat.toLowerCase().includes("ads") || cleanCat.toLowerCase().includes("market") || cleanCat.toLowerCase().includes("promo")) {
          categoryVal = "Marketing";
        } else if (cleanCat.toLowerCase().includes("paper") || cleanCat.toLowerCase().includes("supply") || cleanCat.toLowerCase().includes("office")) {
          categoryVal = "Office Supplies";
        }
      }

      setExtractedData({
        vendor: data.vendor || "Unknown Merchant",
        amount: typeof data.amount === "number" ? data.amount : Number(data.amount) || 0.00,
        category: categoryVal,
        invoice_date: data.invoice_date || new Date().toISOString().substring(0, 10),
      });

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Connection to parsing server failed. Verify API key configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save Confirm Transaction
  const handleConfirmSave = () => {
    if (!extractedData) return;

    const newItem: LedgerItem = {
      id: "led-" + Date.now(),
      vendor: extractedData.vendor,
      amount: Number(extractedData.amount) || 0,
      category: extractedData.category,
      invoice_date: extractedData.invoice_date,
      created_at: new Date().toISOString()
    };

    syncLedgerMutation(newItem, "insert");
    
    // Clear raw textarea & edit form
    setRawText("");
    setExtractedData(null);
  };

  const handleDeleteItem = (itemToDelete: LedgerItem) => {
    syncLedgerMutation(itemToDelete, "delete");
  };

  // Auth Submit logic
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Please provide both email and password.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (signUpErr) throw signUpErr;
        alert("Registration initiated! Please check your email inbox if verification is enabled. Otherwise, try signing in now.");
        setIsSignUp(false);
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (signInErr) throw signInErr;
        setShowAuthModal(false);
      }
    } catch (err: any) {
      console.error("Auth process error:", err);
      setAuthError(err?.message || "Authentication error occurred.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUseSupabaseDB(false);
  };

  const handleLoadSampleReceipt = (type: "fedex" | "aws" | "marketing") => {
    if (type === "fedex") {
      setRawText(`SPEEDY DELIVERIES & FREIGHT SERVICES
Track ID: #FX-4930-8
Shipper Address: Memphis Distribution Ctr, TN
Date of Bill: June 18, 2026
Standard Domestic Linehaul: $450.00
Fuel Surcharges: $75.50
Custom Handling Fees: $24.50
-----------------------------------------
TOTAL INVOICED DIRECT DEBIT: $550.00
Thank you for shipping freight!`);
    } else if (type === "aws") {
      setRawText(`Amazon Web Services Invoice
Invoice Date: 2026-06-19
Billing Period: June 1 - June 15, 2026
Account Number: 9481-0023-4412
Charges Broken Down:
- Elastic Compute Cloud (EC2): $120.40
- Simple Storage Service (S3): $48.10
- Relational Database Service (RDS): $312.50
Tax calculated: $0.00
-----------------------------------------
Total payment due strictly on credit card: $481.00`);
    } else {
      setRawText(`REACH ADVERTISING PARTNERS LTD.
180 Madison Ave, New York
INVOICE REF #RAP-2026-993
Dated: June 14, 2026
Campaign Target Group: Brand Awareness (Spring Refresh)
Digital Impression Network Delivery Cost: $1,250.00
Campaign Optimization Services Cost: $250.00
Subtotal due and collectible: $1,500.00`);
    }
  };

  const triggerCopySQLSnippet = () => {
    const query = `create table ledger (
  id text primary key,
  vendor text not null,
  amount numeric not null,
  category text not null,
  invoice_date date not null,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Recommended: Turn on row-level security for protection
alter table ledger enable row level security;

create policy "Users can modify their own ledger items."
  on ledger for all
  using ( auth.uid() = user_id );`;
    navigator.clipboard.writeText(query);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
  };

  // Stats computations
  const totalAmount = ledger.reduce((sum, item) => sum + item.amount, 0);
  const logisticsTotal = ledger.filter(i => i.category === "Logistics").reduce((sum, i) => sum + i.amount, 0);
  const marketingTotal = ledger.filter(i => i.category === "Marketing").reduce((sum, i) => sum + i.amount, 0);
  const softwareTotal = ledger.filter(i => i.category === "Software").reduce((sum, i) => sum + i.amount, 0);
  const officeTotal = ledger.filter(i => i.category === "Office Supplies").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div id="dashboard-root" className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-slate-200 selection:text-slate-950">
      
      {/* Upper Navigation Header Bar */}
      <header id="ops-header" className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-6 py-4 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-900/10">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Ops Ledger Suite</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-widest flex items-center gap-1">
                  <Cloud className="w-2.5 h-2.5" /> Supabase Enabled
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Document-Parsing Live Ledger • Connected to <span className="font-semibold text-slate-900">https://odzkvgfefdxhswkqiatm.supabase.co</span>
              </p>
            </div>
          </div>
          
          {/* Live Action/Auth Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {user ? (
              <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-slate-600 font-medium">Synced: <strong className="text-slate-900">{user.email}</strong></span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="ml-2 pl-2 border-l border-slate-300 text-slate-500 hover:text-slate-900 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Disconnect live session"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 bg-slate-50 border p-1 rounded">
                  <CloudOff className="w-3.5 h-3.5" /> Offline Mode
                </span>
                <button
                  type="button"
                  id="open-auth-modal-btn"
                  onClick={() => setShowAuthModal(true)}
                  className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Connect Cloud Auth
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="ops-main-panel" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Dynamic Database connection issues or Schema Wizard */}
        {supabaseErrorMsg === "ledger_table_missing" && (
          <div id="missing-table-wizard" className="bg-amber-50 rounded-2xl border border-amber-200 p-5 shadow-xs flex flex-col gap-4 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 shrink-0 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Database Setup Required in Supabase</h3>
                <p className="text-xs text-slate-600 mt-1 leading-normal">
                  You are successfully authenticated using Supabase Auth! However, the <strong className="text-slate-900">ledger</strong> table has not been initialized in your Supabase project databases yet. 
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  We are automatically falling back to secure Local Storage state so you don't lose progress. To enable live cloud sync, paste the SQL schema below in the Supabase SQL Editor.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 relative group overflow-x-auto selection:bg-slate-800">
              <button
                type="button"
                onClick={triggerCopySQLSnippet}
                className="absolute right-3 top-3 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-sans text-[11px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                {sqlCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy SQL
                  </>
                )}
              </button>
              <pre className="pr-20">
{`-- Create table in your Supabase project SQL Editor
create table ledger (
  id text primary key,
  vendor text not null,
  amount numeric not null,
  category text not null,
  invoice_date date not null,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS and insert policy
alter table ledger enable row level security;
create policy "Allow user access" on ledger for all using (auth.uid() = user_id or user_id is null);`}
              </pre>
            </div>
          </div>
        )}

        {supabaseErrorMsg && supabaseErrorMsg !== "ledger_table_missing" && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-4 rounded-xl flex items-center gap-3">
            <ServerCrash className="w-4 h-4 shrink-0 text-rose-600" />
            <p className="font-medium">
              Cloud connection error: <strong className="text-rose-950 font-bold">{supabaseErrorMsg}</strong>. Falling back to secure Local Storage sandbox.
            </p>
          </div>
        )}

        {/* Quick Insights Cards Bar */}
        <section id="insights-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Total Operations Spend</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-semibold tracking-wide uppercase flex items-center gap-1">
              {useSupabaseDB ? (
                <>
                  <Cloud className="w-3 h-3 text-emerald-500" /> Live SQL Ledger
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-slate-400" /> Offline sandbox state
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-50 hover:bg-slate-100/75 transition-colors p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Logistics</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <span className="mt-3 text-lg font-bold text-slate-900">${logisticsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wide mt-1 uppercase">Supply & Freight</span>
          </div>

          <div className="bg-slate-50 hover:bg-slate-100/75 transition-colors p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Marketing</span>
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
            </div>
            <span className="mt-3 text-lg font-bold text-slate-900">${marketingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wide mt-1 uppercase">Media Campaigns</span>
          </div>

          <div className="bg-slate-50 hover:bg-slate-100/75 transition-colors p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Software</span>
              <span className="w-2 h-2 rounded-full bg-violet-500"></span>
            </div>
            <span className="mt-3 text-lg font-bold text-slate-900">${softwareTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wide mt-1 uppercase">SaaS & Cloud</span>
          </div>

          <div className="bg-slate-50 hover:bg-slate-100/75 transition-colors p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Office Supplies</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <span className="mt-3 text-lg font-bold text-slate-900">${officeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wide mt-1 uppercase">Equipment & Paper</span>
          </div>
        </section>

        {/* Beautiful split screen section */}
        <section id="split-panels" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Document Input & Extracted Details (5 Grid Columns) */}
          <div id="extraction-panel" className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Paste Raw Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h2 className="font-semibold text-sm tracking-wide">Receipt AI Intake</h2>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>Target: gemini-2.5-flash</span>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="raw-text-area" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Paste Raw Receipt Text
                    </label>
                    <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">
                      Plaintext OCR or Text
                    </span>
                  </div>
                  
                  <textarea
                    id="raw-text-area"
                    className="w-full h-44 p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl focus:ring-1 focus:ring-slate-950 font-mono text-xs text-slate-700 leading-relaxed transition-all placeholder:text-slate-400 focus:bg-white resize-none"
                    placeholder="SPEEDY DELIVERIES FREIGHT BILL... total charge $550..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>

                {/* Quick-load Presets to help Neha test rapidly */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Or select a real-world ops template:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSampleReceipt("fedex")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      🚚 Freight FedEx Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleReceipt("aws")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      ☁️ AWS Hosted Cloud Bill
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleReceipt("marketing")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      📣 Meta/Reach Promo Campaign
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Processing Issue</p>
                      <p className="text-[11px] text-rose-700/90">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  id="parse-document-btn"
                  onClick={handleParseDocument}
                  disabled={isLoading}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      Parsing with server-side flash model...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Parse Document with Gemini AI
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editable Form Card (Stays hidden until extraction complete) */}
            {extractedData && (
              <div id="editable-form-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 animate-slideDown">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Tweak Parsed Invoice Values</h3>
                  </div>
                  <span className="text-[10px] bg-slate-100 border text-slate-600 px-2 py-0.5 rounded font-semibold tracking-wider uppercase">
                    Verification Panel
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  
                  {/* Vendor Name */}
                  <div>
                    <label htmlFor="form-vendor" className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                      Vendor Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="form-vendor"
                        type="text"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:bg-white focus:border-slate-950 transition-colors"
                        value={extractedData.vendor}
                        onChange={(e) => setExtractedData({ ...extractedData, vendor: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Amount / Category Double inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="form-amount" className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                        Total Amount ($)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <DollarSign className="w-3.5 h-3.5" />
                        </div>
                        <input
                          id="form-amount"
                          type="number"
                          step="0.01"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:bg-white focus:border-slate-950 transition-colors"
                          value={extractedData.amount}
                          onChange={(e) => setExtractedData({ ...extractedData, amount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="form-category" className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                        Spending Category
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <select
                          id="form-category"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:bg-white focus:border-slate-950 transition-colors cursor-pointer"
                          value={extractedData.category}
                          onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value as any })}
                        >
                          <option value="Logistics">Logistics</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Software">Software</option>
                          <option value="Office Supplies">Office Supplies</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Date */}
                  <div>
                    <label htmlFor="form-invoice-date" className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                      Invoice Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="form-invoice-date"
                        type="text"
                        placeholder="YYYY-MM-DD"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:bg-white focus:border-slate-950 transition-colors"
                        value={extractedData.invoice_date}
                        onChange={(e) => setExtractedData({ ...extractedData, invoice_date: e.target.value })}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setExtractedData(null)}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    id="confirm-ledger-btn"
                    onClick={handleConfirmSave}
                    className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Confirm & Save {useSupabaseDB ? "to Cloud" : "to Device"}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Ledger Data Table (7 Grid Columns) */}
          <div id="ledger-panel" className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Table Header Controls */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Operations General Ledger</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {useSupabaseDB ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Cloud className="w-3 h-3 text-emerald-500 shrink-0" /> Live SQL Cloud Connected
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-widest flex items-center gap-1">
                        <CloudOff className="w-3 h-3 text-slate-400 shrink-0" /> Local Sandbox Fallback
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs bg-slate-50 border border-slate-200/80 text-slate-700 px-3 py-1.5 rounded-lg font-bold">
                  {ledger.length} Row{ledger.length !== 1 && "s"} Listed
                </span>
                
                {!useSupabaseDB && ledger.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to clear your local ledger state?")) {
                        setLedger([]);
                        localStorage.removeItem("nep_ops_ledger");
                      }
                    }}
                    className="p-1.5 border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Clear ledger list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto relative min-h-[300px]">
              {dbLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
                    <p className="text-xs font-semibold text-slate-600">Querying live SQL records...</p>
                  </div>
                </div>
              )}
              
              <table id="ledger-table" className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Vendor</th>
                    <th className="py-3 px-5">Invoice Date</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5 text-right">Amount</th>
                    <th className="py-3 px-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2 max-w-xs mx-auto">
                          <Database className="w-8 h-8 text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">Ops ledger is empty</p>
                          <p className="text-[11px] text-slate-400 leading-normal">
                            No receipts parsed or listed yet. Put custom raw texts in the Intake panel on the left to start ledger sync.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ledger.map((item) => (
                      <tr key={item.id} className="text-xs text-slate-700 hover:bg-slate-50/60 transition-colors group">
                        
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-900 transition-colors"></span>
                            {item.vendor}
                          </div>
                        </td>

                        <td className="py-3.5 px-5 font-medium font-mono text-slate-500 whitespace-nowrap">
                          {item.invoice_date}
                        </td>

                        <td className="py-3.5 px-5">
                          <span className={`${
                            item.category === "Software" ? "bg-purple-50 text-purple-700 border-purple-200" :
                            item.category === "Logistics" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            item.category === "Marketing" ? "bg-pink-50 text-pink-700 border-pink-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          } px-2 py-0.5 rounded-full text-[10px] font-semibold border`}>
                            {item.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-5 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                            title="Delete transaction line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Aggregate Footer Summary Panel */}
            {ledger.length > 0 && (
              <div id="ledger-footer" className="bg-slate-50/50 p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-3">
                <span className="text-slate-400 font-medium tracking-wide font-mono">
                  AGGREGATED FINANCIAL LEDGER SUMMARY
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold">Total Verified:</span>
                  <span className="text-slate-900 font-extrabold font-mono text-sm">
                    ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

          </div>

        </section>

      </main>

      {/* Supabase Authentication Modal */}
      {showAuthModal && (
        <div id="auth-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden w-full max-w-md animate-scaleUp">
            
            {/* Header Banner */}
            <div className="bg-slate-900 text-white p-6 relative">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg tracking-tight">Supabase Security</h3>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Sign in to route your parsed ledger records directly to your secure cloud database at <strong className="text-white font-medium">https://odzkvgfefdxhswkqiatm.supabase.co</strong>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="neha.ops@yourcompany.com"
                  className="w-full p-2.5 border border-slate-200 focus:border-slate-950 rounded-lg text-xs"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Minimum 6 Characters
                  </span>
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full p-2.5 border border-slate-200 focus:border-slate-950 rounded-lg text-xs"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="font-medium text-[11px] leading-relaxed">{authError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-10 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : isSignUp ? (
                  "Create Cloud Account"
                ) : (
                  "Sign In Securely"
                )}
              </button>

              <div className="text-center mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-all underline decoration-1"
                >
                  {isSignUp
                    ? "Already have an operations account? Log In"
                    : "First time here? Register new Supabase account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Copyright Label Bar */}
      <footer id="dashboard-footer" className="bg-white border-t border-slate-200 py-5 mt-auto text-center text-[11px] text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            Designed exclusively for Operation Leaders. Runs locally on sandboxed context.
          </p>
          <p className="font-semibold text-slate-400 flex items-center justify-center gap-1">
            <Database className="w-3.5 h-3.5 text-emerald-500" /> Secure Supabase & Google Gemini 2.5 Cloud Integration
          </p>
        </div>
      </footer>
    </div>
  );
}
