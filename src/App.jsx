import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import {
  SlidersHorizontal,
  Calendar,
  Map as MapIcon,
  MapPin,
  Store,
  User,
  Globe,
  Package,
  Ruler,
  CheckCircle2,
  Smartphone,
  RotateCcw,
  Download,
  LogOut,
  ScanLine,
  Clock,
  XCircle,
  Users,
  PhoneMissed,
  Phone,
  BarChart2,
  Award,
  PackageCheck,
  TrendingUp,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';

// ── CONSTANTS ─────────────────────────────────────────────
const TARGET_DISTRICTS = ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Raipur', 'Bilaspur', 'Durg', 'Korba', 'Jagdalpur'];

const STATE_COORDS = {
  'Uttar Pradesh': [26.84, 80.94],
  'Chhattisgarh': [21.27, 81.86],
  'West Bengal': [22.98, 87.85],
  'Andhra Pradesh': [15.91, 79.74],
  'Telangana': [18.11, 79.01],
  'Karnataka': [15.31, 75.71],
  'Maharashtra': [19.75, 75.71],
  'Bihar': [25.09, 85.31],
  'Tamil Nadu': [11.12, 78.65],
  'Odisha': [20.95, 85.09],
  'Rajasthan': [27.02, 74.21],
  'Madhya Pradesh': [22.97, 78.65],
  'Gujarat': [22.25, 71.19],
  'Punjab': [31.14, 75.34],
  'Haryana': [29.05, 76.08],
  'Kerala': [10.85, 76.27],
  'Assam': [26.20, 92.93],
  'Jharkhand': [23.61, 85.27],
  'Delhi': [28.70, 77.10]
};

const USERS = {
  'digicides': { password: 'shrirambioseed', role: 'user' },
  'developer': { password: 'de^el0per', role: 'developer' }
};

const PALETTE = ['#1A7A3C', '#E8620A', '#1565C0', '#6B21A8', '#0D7377', '#C97D10', '#C0392B', '#22A050', '#F97316', '#2DC76D', '#FEA64A', '#4CAF50'];

// ── DATA CLEANING HELPERS ─────────────────────────────────
const trimStr = (s) => (s == null ? '' : String(s).trim());

const normalizeDate = (dateStr) => {
  if (!dateStr) return null;
  const s = trimStr(dateStr);
  
  // DD-MM-YYYY HH:MM or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  // M/D/YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(m[1]) - 1, Number(m[2]));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (dateStr) => {
  const d = normalizeDate(dateStr);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const normalizePhone = (ph) => {
  if (!ph) return '';
  const s = String(ph).replace(/\D/g, ''); // Keep only digits
  if (s.length === 12 && s.startsWith('91')) {
    return s.slice(2);
  }
  if (s.length === 11 && s.startsWith('0')) {
    return s.slice(1);
  }
  return s;
};

const formatNumber = (num) => Math.round(num).toLocaleString('en-IN');

const parseCartItems = (str) => {
  const s = trimStr(str);
  if (!s) return [];
  return s.split(',').map(raw => {
    const t = raw.trim();
    const m = t.match(/^(.+?)\s*-\s*qty\s*(\d+)(?:\s*-\s*(.+))?$/i);
    if (m) return { name: trimStr(m[1]), qty: Number(m[2]) || 1, unit: m[3] ? trimStr(m[3]) : '' };
    
    // Basanti x2 (3Kg) or Basanti x1 (3Kg) format
    const m2 = t.match(/^(.+?)\s*x\s*(\d+)\s*(?:\((.+?)\))?$/i);
    if (m2) return { name: trimStr(m2[1]), qty: Number(m2[2]) || 1, unit: m2[3] ? trimStr(m2[3]) : '' };
    
    return { name: t, qty: 1, unit: '' };
  });
};

const parseProductMap = (str) => {
  const map = new Map();
  parseCartItems(str).forEach(({ name, qty }) => {
    map.set(name, (map.get(name) || 0) + qty);
  });
  return map;
};

// Map View Update Handler
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

export default function App() {
  // Authentication & State
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('shriram_bioseed_auth') === '1');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState('');
  
  // Datasets
  const [scans, setScans] = useState([]);
  const [mcData, setMcData] = useState([]);
  const [reference, setReference] = useState([]);
  const [refGrandTotal, setRefGrandTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState('overview');

  // Filters State
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    state: '',
    district: '',
    retailer: '',
    pt: '',
    zone: '',
    product: '',
    unit: '',
    status: '',
    source: ''
  });

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ── 1. AUTHENTICATION ─────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass;
    if (USERS[u] && USERS[u].password === p) {
      localStorage.setItem('shriram_bioseed_auth', '1');
      setIsAuthenticated(true);
      setLoginErr('');
    } else {
      setLoginErr('Invalid username or password. Please try again.');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Sign out of Shriram Bioseed Campaign Intelligence Dashboard?')) {
      localStorage.removeItem('shriram_bioseed_auth');
      setIsAuthenticated(false);
      window.location.reload();
    }
  };

  // ── 2. DATA IMPORT & CLEANING ──────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadCSVData = async () => {
      try {
        setLoading(true);

        // A. Load data.csv
        const scansRes = await fetch('./data.csv').then(r => r.text());
        const scansParsed = Papa.parse(scansRes, { header: true, skipEmptyLines: true }).data;
        const normalizedScans = scansParsed.map((r, idx) => ({
          id: r['User ID'] || r['UserID'] || String(idx),
          phone: r['Phone Number'] || r['Phone'] || '',
          firstName: r['First Name'] || r['FirstName'] || '',
          lastName: r['Last Name'] || r['LastName'] || '',
          district: r['District'] || '',
          state: r['State'] || '',
          scanDate: r['Scan Date'] || r['Date'] || '',
          rin: r['RIN'] || '',
          retailerName: r['Retailer Name'] || r['Retailer'] || '',
          cartItems: r['Cart Items'] || '',
          submissionStatus: r['Submission Status'] || '',
          source: r['Source'] || '',
          pt: r['PT'] || '',
          zone: r['Zone'] || ''
        }));
        setScans(normalizedScans);

        // B. Load reference.csv
        const refRes = await fetch('./reference.csv').then(r => r.text());
        const refParsed = Papa.parse(refRes, { header: true, skipEmptyLines: true }).data;
        const filteredRef = refParsed.filter(r => !trimStr(r.Name || '').toLowerCase().includes('grand total'));
        const gtRecord = refParsed.find(r => trimStr(r.Name || '').toLowerCase().includes('grand total'));
        
        setReference(filteredRef);
        if (gtRecord) {
          setRefGrandTotal({
            total: Number(gtRecord['Total Missed Calls']) || 0,
            unique: Number(gtRecord['Total Unique Missed Calls']) || 0
          });
        }

        // C. Load mc_data.csv
        const mcRes = await fetch('./mc_data.csv').then(r => r.text());
        const mcParsed = Papa.parse(mcRes, { header: true, skipEmptyLines: true }).data;
        
        // Build mappings from data.csv scans & reference.csv FAs
        const phoneToPTMap = new Map();
        normalizedScans.forEach(row => {
          const normPh = normalizePhone(row.phone);
          const ptName = trimStr(row.pt);
          if (normPh && ptName) {
            phoneToPTMap.set(normPh, ptName);
          }
        });

        const hqToPTMap = new Map();
        filteredRef.forEach(row => {
          const ptName = trimStr(row.Name);
          const hq = trimStr(row.HQ || row.hq || row.Hq);
          if (ptName && hq) {
            hqToPTMap.set(hq.toLowerCase(), ptName);
          }
        });

        const enrichedMC = mcParsed.map(r => {
          const rawGrower = r.Grower || r.grower || r.Phone || '';
          const normPh = normalizePhone(rawGrower);
          let ptName = '';
          
          if (normPh && phoneToPTMap.has(normPh)) {
            ptName = phoneToPTMap.get(normPh);
          } else {
            const distKey = trimStr(r.District || r.district).toLowerCase();
            if (distKey && hqToPTMap.has(distKey)) {
              ptName = hqToPTMap.get(distKey);
            }
          }

          return {
            grower: rawGrower,
            state: r.State || r.state || '',
            district: r.District || r.district || '',
            date: r.Date || r.date || '',
            zone: r.Zone || r.zone || '',
            pt: ptName
          };
        });

        setMcData(enrichedMC);

      } catch (err) {
        console.error("Error parsing source campaign CSV datasets:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCSVData();
  }, [isAuthenticated]);

  // ── 3. DATA PROCESSING PIPELINE (UNIFIED STATE FILTERING) ───
  const filteredData = useMemo(() => {
    const f = filters;

    // Filter Scans
    const filteredScans = scans.filter(r => {
      if (f.dateFrom || f.dateTo) {
        const dk = toDateKey(r.scanDate);
        if (f.dateFrom && dk < f.dateFrom) return false;
        if (f.dateTo && dk > f.dateTo) return false;
      }
      if (f.state && trimStr(r.state) !== f.state) return false;
      if (f.district && trimStr(r.district) !== f.district) return false;
      if (f.retailer && trimStr(r.retailerName) !== f.retailer) return false;
      if (f.pt && trimStr(r.pt) !== f.pt) return false;
      if (f.zone && trimStr(r.zone) !== f.zone) return false;
      if (f.status && trimStr(r.submissionStatus).toLowerCase() !== f.status.toLowerCase()) return false;
      if (f.source && trimStr(r.source) !== f.source) return false;
      if (f.product) {
        if (!parseProductMap(r.cartItems).has(f.product)) return false;
      }
      if (f.unit) {
        const hasUnit = parseCartItems(r.cartItems).some(it => f.product ? it.name === f.product && it.unit === f.unit : it.unit === f.unit);
        if (!hasUnit) return false;
      }
      return true;
    });

    // Filter Missed Calls (Cascade filters dynamically!)
    const filteredMC = mcData.filter(r => {
      if (f.dateFrom || f.dateTo) {
        const dk = toDateKey(r.date);
        if (f.dateFrom && dk < f.dateFrom) return false;
        if (f.dateTo && dk > f.dateTo) return false;
      }
      if (f.state && (trimStr(r.state) === 'UP' ? 'Uttar Pradesh' : trimStr(r.state) === 'CG' ? 'Chhattisgarh' : trimStr(r.state)) !== f.state) return false;
      if (f.district && trimStr(r.district) !== f.district) return false;
      if (f.zone && trimStr(r.zone) !== f.zone) return false;
      if (f.pt && trimStr(r.pt) !== f.pt) return false;
      return true;
    });

    // Filter Reference Benchmarks (Cascade filter by State/Zone)
    const filteredRef = reference.filter(r => {
      if (f.state && trimStr(r.State) !== (f.state === 'Uttar Pradesh' ? 'UP' : f.state === 'Chhattisgarh' ? 'CG' : f.state)) return false;
      if (f.zone && trimStr(r.Zone || r.ZONE) !== f.zone) return false;
      if (f.pt && trimStr(r.Name) !== f.pt) return false;
      return true;
    });

    return {
      scans: filteredScans,
      missedCalls: filteredMC,
      reference: filteredRef
    };
  }, [scans, mcData, reference, filters]);

  // Dynamic filter drop-down populations
  const dropDownOptions = useMemo(() => {
    // Populate dropdown lists based on ALL loaded records to preserve absolute selection paths
    const states = [...new Set(scans.map(r => trimStr(r.state)))].filter(Boolean).sort();
    const districts = [...new Set(scans.map(r => trimStr(r.district)))].filter(Boolean).sort();
    const retailers = [...new Set(scans.map(r => trimStr(r.retailerName)))].filter(Boolean).sort();
    const products = [...new Set(scans.flatMap(r => [...parseProductMap(r.cartItems).keys()]))].filter(Boolean).sort();
    const units = [...new Set(scans.flatMap(r => parseCartItems(r.cartItems).map(i => i.unit)))].filter(Boolean).sort();
    const sources = [...new Set(scans.map(r => trimStr(r.source)))].filter(Boolean).sort();
    const zones = [...new Set([...scans.map(r => trimStr(r.zone)), ...reference.map(r => trimStr(r.Zone || r.ZONE))])].filter(Boolean).sort();
    const pts = [...new Set([...scans.map(r => trimStr(r.pt)), ...reference.map(r => trimStr(r.Name))])].filter(Boolean).sort();

    return { states, districts, retailers, products, units, sources, zones, pts };
  }, [scans, reference]);

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const resetAllFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      state: '',
      district: '',
      retailer: '',
      pt: '',
      zone: '',
      product: '',
      unit: '',
      status: '',
      source: ''
    });
  };

  // Export Filtered CSV Data
  const handleExportCSV = () => {
    const dataToExport = filteredData.scans;
    if (!dataToExport.length) {
      alert("No scanner records found for current filter selection!");
      return;
    }
    const csvContent = Papa.unparse(dataToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bioseed_campaign_intelligence_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── 4. ANALYTICAL DERIVED KPI CALCULATORS ────────────────
  const kpis = useMemo(() => {
    const s = filteredData.scans;
    const total = s.length;
    const approved = s.filter(r => /^yes$/i.test(r.submissionStatus)).length;
    const pending = s.filter(r => /^pending$/i.test(r.submissionStatus)).length;
    const rejected = s.filter(r => /^no$/i.test(r.submissionStatus)).length;

    const uniqueFarmers = new Set(s.map(r => r.phone).filter(Boolean)).size;
    const activeRetailers = new Set(s.map(r => r.rin).filter(Boolean)).size;

    // Missed Call stats
    const mc = filteredData.missedCalls;
    const totalMC = mc.length;
    const uniqueMC = new Set(mc.map(r => r.grower).filter(Boolean)).size;

    return {
      total,
      approved,
      approvedPct: total ? ((approved / total) * 100).toFixed(1) : '0.0',
      pending,
      pendingPct: total ? ((pending / total) * 100).toFixed(1) : '0.0',
      rejected,
      rejectedPct: total ? ((rejected / total) * 100).toFixed(1) : '0.0',
      uniqueFarmers,
      activeRetailers,
      totalMC,
      uniqueMC
    };
  }, [filteredData]);

  // ── LOGIN PAGE OVERLAY RENDER ─────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#091F11] via-[#113C20] to-[#0A2414] relative p-4 overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(45,199,109,0.08)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-green/10 rounded-full blur-[140px] pointer-events-none" />
        
        <form onSubmit={handleLogin} className="bg-white/95 backdrop-blur-md rounded-3xl p-8 md:p-12 w-full max-w-[420px] shadow-2xl relative z-10 border border-white/20 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2.5 bg-brand-green/10 rounded-2xl">
              <span className="text-3xl">🌱</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-brand-green tracking-tight leading-none">Shriram Bioseed</h1>
              <p className="text-xs font-semibold text-brand-text2 tracking-wider uppercase mt-1">Seed Intelligence Suite</p>
            </div>
          </div>
          
          <div className="h-[1px] bg-brand-bg/80 w-full my-5" />
          
          <h2 className="text-2xl font-black text-brand-text tracking-tight mb-1">Welcome back</h2>
          <p className="text-sm text-brand-text2 mb-6">Sign in to access your campaign dashboard</p>
          
          {loginErr && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{loginErr}</span>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text2 mb-1.5">Username</label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-brand-bg border border-brand-text3/35 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green font-medium text-sm transition-all"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text2 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-brand-bg border border-brand-text3/35 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green font-medium text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-brand-green to-brand-green2 text-white font-bold py-3.5 px-6 rounded-xl hover:translate-y-[-1px] active:translate-y-[0px] hover:shadow-lg hover:shadow-brand-green/30 transition-all text-sm uppercase tracking-wider"
          >
            Sign In
          </button>
          
          <p className="text-center text-[10px] text-brand-text3 font-medium mt-6">© 2026 Shriram Bioseed · Campaign Intelligence Platform</p>
        </form>
      </div>
    );
  }

  // ── LOADING SPLASH ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg">
        <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 border-[3.5px] border-brand-green/20 rounded-full" />
          <div className="absolute inset-0 border-[3.5px] border-brand-green rounded-full border-t-transparent animate-spin" />
          <span className="text-2xl">🌱</span>
        </div>
        <p className="text-sm font-bold text-brand-green tracking-wider uppercase animate-pulse">Syncing campaign database...</p>
      </div>
    );
  }

  // ── CORE DATA RENDER MODULES ──────────────────────────────
  const renderSidebarFilters = (isMobile = false) => (
    <div className={`flex flex-col gap-5 ${isMobile ? 'p-6' : ''}`}>
      <div className="flex items-center justify-between border-b border-brand-bg pb-3">
        <div className="flex items-center gap-2 text-brand-text font-extrabold text-sm uppercase tracking-widest">
          <SlidersHorizontal className="w-4 h-4 text-brand-green" />
          <span>Filters</span>
        </div>
        {isMobile && (
          <button onClick={() => setMobileFilterOpen(false)} className="p-1 rounded-full bg-brand-bg hover:bg-brand-text3/20 transition-all">
            <X className="w-5 h-5 text-brand-text2" />
          </button>
        )}
      </div>

      {/* Date Range */}
      <div className="space-y-3">
        <span className="text-[10px] font-black uppercase text-brand-green tracking-wider block">Time Period</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-bold text-brand-text2 block mb-1 uppercase">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full text-xs font-semibold text-brand-text bg-brand-bg border border-brand-bg px-2.5 py-2 rounded-lg outline-none focus:border-brand-green"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-brand-text2 block mb-1 uppercase">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full text-xs font-semibold text-brand-text bg-brand-bg border border-brand-bg px-2.5 py-2 rounded-lg outline-none focus:border-brand-green"
            />
          </div>
        </div>
      </div>

      <hr className="border-t border-dashed border-brand-bg" />

      {/* Geography */}
      <div className="space-y-3">
        <span className="text-[10px] font-black uppercase text-brand-green tracking-wider block">Geography</span>
        <div className="space-y-2.5">
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <MapIcon className="w-3.5 h-3.5 text-brand-green/80" /> State
            </label>
            <select
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.states.length})</option>
              {dropDownOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <MapPin className="w-3.5 h-3.5 text-brand-green/80" /> District
            </label>
            <select
              value={filters.district}
              onChange={(e) => handleFilterChange('district', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.districts.length})</option>
              {dropDownOptions.districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-t border-dashed border-brand-bg" />

      {/* Channel */}
      <div className="space-y-3">
        <span className="text-[10px] font-black uppercase text-brand-green tracking-wider block">Channel & Staff</span>
        <div className="space-y-2.5">
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <Store className="w-3.5 h-3.5 text-brand-green/80" /> Retailer
            </label>
            <select
              value={filters.retailer}
              onChange={(e) => handleFilterChange('retailer', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.retailers.length})</option>
              {dropDownOptions.retailers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <User className="w-3.5 h-3.5 text-brand-green/80" /> Promoter (PT)
            </label>
            <select
              value={filters.pt}
              onChange={(e) => handleFilterChange('pt', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.pts.length})</option>
              {dropDownOptions.pts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <Globe className="w-3.5 h-3.5 text-brand-green/80" /> Marketing Zone
            </label>
            <select
              value={filters.zone}
              onChange={(e) => handleFilterChange('zone', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.zones.length})</option>
              {dropDownOptions.zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-t border-dashed border-brand-bg" />

      {/* Product */}
      <div className="space-y-3">
        <span className="text-[10px] font-black uppercase text-brand-green tracking-wider block">Seed Product</span>
        <div className="space-y-2.5">
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <Package className="w-3.5 h-3.5 text-brand-green/80" /> Seed Brand
            </label>
            <select
              value={filters.product}
              onChange={(e) => handleFilterChange('product', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.products.length})</option>
              {dropDownOptions.products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <Ruler className="w-3.5 h-3.5 text-brand-green/80" /> Packaging Unit
            </label>
            <select
              value={filters.unit}
              onChange={(e) => handleFilterChange('unit', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.units.length})</option>
              {dropDownOptions.units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-t border-dashed border-brand-bg" />

      {/* Status & Source */}
      <div className="space-y-3">
        <span className="text-[10px] font-black uppercase text-brand-green tracking-wider block">Submission</span>
        <div className="space-y-2.5">
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-green/80" /> Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All statuses</option>
              <option value="Yes">Approved</option>
              <option value="No">Rejected</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-brand-text2 flex items-center gap-1.5 mb-1.5 uppercase">
              <Smartphone className="w-3.5 h-3.5 text-brand-green/80" /> Entry Source
            </label>
            <select
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
              className="w-full text-xs font-semibold bg-brand-bg border border-brand-bg px-3 py-2 rounded-lg outline-none focus:border-brand-green"
            >
              <option value="">All ({dropDownOptions.sources.length})</option>
              {dropDownOptions.sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-t border-brand-bg" />

      {/* Reset */}
      <button
        onClick={resetAllFilters}
        className="w-full flex items-center justify-center gap-2 bg-brand-bg/80 border border-brand-text3/30 text-brand-text2 font-bold py-2.5 px-4 rounded-xl hover:bg-brand-green hover:border-brand-green hover:text-white transition-all text-xs uppercase"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Reset Filters</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen relative z-10">
      
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-brand-text3/20 shadow-md">
        <div className="px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌱</span>
            <div className="h-7 w-[1px] bg-brand-text3/30 hidden md:block" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-extrabold text-brand-green tracking-tight">Shriram Bioseed</span>
              <span className="text-[10px] font-bold text-brand-text3 tracking-widest uppercase">Campaign Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 bg-brand-green/10 text-brand-green rounded-full border border-brand-green/20">
              <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse shadow-md" />
              UP & CG Campaign 2026
            </span>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 border border-brand-text3/35 px-4 py-2 bg-brand-bg hover:bg-brand-green hover:border-brand-green hover:text-white hover:shadow-lg transition-all rounded-xl text-xs font-bold text-brand-text2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all rounded-xl text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TAB BAR ─────────────────────────────────────── */}
        <div className="px-4 md:px-8 bg-white border-t border-brand-bg flex items-center overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { id: 'overview', icon: <TrendingUp className="w-4 h-4" />, label: 'Overview' },
            { id: 'fa', icon: <User className="w-4 h-4" />, label: 'FA Performance' },
            { id: 'retailer', icon: <Store className="w-4 h-4" />, label: 'Retailer Analytics' },
            { id: 'district', icon: <MapPin className="w-4 h-4" />, label: 'District Insights' },
            { id: 'sku', icon: <Package className="w-4 h-4" />, label: 'SKU Analysis' },
            { id: 'repeat', icon: <RotateCcw className="w-4 h-4" />, label: 'Repeat Farmers' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-brand-green text-brand-green bg-brand-green/5'
                  : 'border-transparent text-brand-text3 hover:text-brand-green'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── APP BODY LAYOUT ──────────────────────────────── */}
      <div className="flex-1 flex max-w-[1920px] mx-auto w-full relative z-10">
        
        {/* DESKTOP SIDEBAR FILTERS (Hidden on mobile < 1100px) */}
        <aside className="w-[280px] bg-white border-r border-brand-text3/20 p-6 flex-shrink-0 sticky top-[112px] h-[calc(100vh-112px)] overflow-y-auto no-scrollbar hidden xl:block shadow-sm">
          {renderSidebarFilters()}
        </aside>

        {/* MAIN PANEL */}
        <main className="flex-1 p-4 md:p-8 overflow-hidden min-h-screen">
          {renderActiveTabContent()}
        </main>
      </div>

      {/* ── MOBILE FILTER FLOATING FOOTER ACTION (Show < 1100px) ── */}
      <div className="xl:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMobileFilterOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-green to-brand-green2 text-white font-bold py-3 px-6 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs tracking-wider uppercase border border-brand-green3/30"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="w-5 h-5 bg-brand-orange text-white rounded-full flex items-center justify-center text-[9px] font-black">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* MOBILE FILTER SIDEBAR OVERLAY DRAWER */}
      {mobileFilterOpen && (
        <div className="xl:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-[320px] bg-white h-full overflow-y-auto shadow-2xl animate-slide-in relative flex flex-col justify-between">
            {renderSidebarFilters(true)}
          </div>
        </div>
      )}

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="py-4 border-t border-brand-text3/20 bg-white text-center text-xs font-semibold text-brand-text3 flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-4 z-10 relative">
        <span>© 2026 Shriram Bioseed</span>
        <span className="w-1.5 h-1.5 bg-brand-text3 rounded-full hidden sm:inline" />
        <span>Campaign Intelligence Suite</span>
        <span className="w-1.5 h-1.5 bg-brand-text3 rounded-full hidden sm:inline" />
        <span>Uttar Pradesh & Chhattisgarh</span>
      </footer>

    </div>
  );

  // ── 5. TAB RENDER CONTROLLER ──────────────────────────────
  function renderActiveTabContent() {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={filteredData} kpis={kpis} setFilters={setFilters} />;
      case 'fa':
        return <FATab data={filteredData} />;
      case 'retailer':
        return <RetailerTab data={filteredData} />;
      case 'district':
        return <DistrictTab data={filteredData} />;
      case 'sku':
        return <SKUTab data={filteredData} />;
      case 'repeat':
        return <RepeatTab data={filteredData} />;
      default:
        return null;
    }
  }
}

// ── 6. OVERVIEW TAB COMPONENT ─────────────────────────────
function OverviewTab({ data, kpis, setFilters }) {
  // Line Chart Trend
  const trendData = useMemo(() => {
    const tMap = new Map();
    data.scans.forEach(r => {
      const k = toDateKey(r.scanDate);
      if (k) tMap.set(k, (tMap.get(k) || 0) + 1);
    });
    return [...tMap].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, Scans: value }));
  }, [data.scans]);

  // Donut Submission Status
  const statusData = [
    { name: 'Approved', value: kpis.approved, color: '#1A7A3C' },
    { name: 'Pending', value: kpis.pending, color: '#C97D10' },
    { name: 'Rejected', value: kpis.rejected, color: '#C0392B' }
  ].filter(d => d.value > 0);

  // Donut Sources
  const sourceData = useMemo(() => {
    const srcMap = {};
    data.scans.forEach(r => {
      const s = trimStr(r.source) || '(Unknown)';
      srcMap[s] = (srcMap[s] || 0) + 1;
    });
    return Object.entries(srcMap).map(([name, val], idx) => ({
      name,
      value: val,
      color: PALETTE[idx % PALETTE.length]
    })).sort((a, b) => b.value - a.value);
  }, [data.scans]);

  // Donut Channels (FA vs Direct)
  const channelData = useMemo(() => {
    const faCount = data.scans.filter(r => trimStr(r.pt)).length;
    const directCount = data.scans.length - faCount;
    return [
      { name: 'FA-Driven', value: faCount, color: '#1A7A3C' },
      { name: 'Walk-in / Direct', value: directCount, color: '#E8620A' }
    ].filter(c => c.value > 0);
  }, [data.scans]);

  // Map Data Markers
  const mapMarkers = useMemo(() => {
    const states = {};
    data.scans.forEach(r => {
      const st = trimStr(r.state);
      if (!st) return;
      if (!states[st]) states[st] = { total: 0, yes: 0, no: 0, pending: 0 };
      states[st].total++;
      
      const sStatus = trimStr(r.submissionStatus).toLowerCase();
      if (sStatus === 'yes') states[st].yes++;
      else if (sStatus === 'no') states[st].no++;
      else if (sStatus === 'pending') states[st].pending++;
    });

    return Object.entries(states).map(([state, counts]) => {
      const coords = STATE_COORDS[state];
      const rate = counts.total ? Math.round((counts.yes / counts.total) * 100) : 0;
      const isTarget = state === 'Uttar Pradesh' || state === 'Chhattisgarh';
      return { state, coords, counts, rate, isTarget };
    }).filter(m => m.coords);
  }, [data.scans]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-brand-text3/20 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-text tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
            Campaign Overview
          </h2>
          <p className="text-xs font-semibold text-brand-text3 mt-0.5">Uttar Pradesh & Chhattisgarh · Campaign Dashboard 2026</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Total Scans */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
              <ScanLine className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-brand-green/10 text-brand-green rounded-full">Live</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.total)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Total Scans</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Unified total scans received</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-brand-green rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        {/* KPI: Approved */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-brand-green2/10 text-brand-green2 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-brand-green2/10 text-brand-green2 rounded-full">{kpis.approvedPct}%</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.approved)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Approved</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Submissions approved</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-brand-green2 rounded-full" style={{ width: `${kpis.approvedPct}%` }} />
          </div>
        </div>

        {/* KPI: Pending */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-brand-orange3/25 text-brand-orange rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-brand-orange3/20 text-brand-orange rounded-full">{kpis.pendingPct}%</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.pending)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Pending Review</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Awaiting physical validation</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-brand-orange rounded-full" style={{ width: `${kpis.pendingPct}%` }} />
          </div>
        </div>

        {/* KPI: Rejected */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <XCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-red-100 text-red-600 rounded-full">{kpis.rejectedPct}%</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.rejected)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Rejected</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Declined coupon submissions</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${kpis.rejectedPct}%` }} />
          </div>
        </div>

      </div>

      {/* KPI Row 2: Customer Focus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Total Unique Farmers */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">Farmers</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.uniqueFarmers)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Unique Farmers</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Distinct numbers registered</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: '80%' }} />
          </div>
        </div>

        {/* KPI: Active Retailers */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full">Active</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.activeRetailers)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Active Dealers</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Authorized retail centers</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: '70%' }} />
          </div>
        </div>

        {/* KPI: Missed Calls */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
              <PhoneMissed className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full">Calls</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.totalMC)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Missed Calls</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Total calls tracked globally</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: '75%' }} />
          </div>
        </div>

        {/* KPI: Unique Callers */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-xl">
              <Phone className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-brand-orange/10 text-brand-orange rounded-full">Unique</span>
          </div>
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(kpis.uniqueMC)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Unique Callers</span>
          <span className="text-[10px] text-brand-text3 mt-1.5 block">Distinct numbers dialled in</span>
          <div className="w-full h-1 bg-brand-bg rounded-full overflow-hidden mt-4">
            <div className="h-full bg-brand-orange rounded-full" style={{ width: '65%' }} />
          </div>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Area Chart */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Daily Scan Trend</span>
          </div>
          <div className="h-[280px] w-full">
            {trendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1A7A3C" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1A7A3C" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="date" tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #dde8e1', borderRadius: '12px' }}
                    labelStyle={{ fontWeight: 700, color: '#0d1f15' }}
                  />
                  <Area type="monotone" dataKey="Scans" stroke="#1A7A3C" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScans)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-brand-text3">No scan logs in this filter window.</div>
            )}
          </div>
        </div>

        {/* Approval Pie Chart */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Approval Status</span>
          </div>
          <div className="h-[200px] w-full flex items-center justify-center">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No status distributions found.</div>
            )}
          </div>
          <div className="space-y-2 mt-4">
            {statusData.map(d => {
              const val = d.value;
              const total = kpis.total;
              const pct = total ? ((val / total) * 100).toFixed(1) : '0';
              return (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-semibold text-brand-text2">{d.name}</span>
                  </div>
                  <span className="font-bold text-brand-text">{formatNumber(val)} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Sources & Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Source Pie */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Participation by Source</span>
          </div>
          <div className="h-[180px] w-full flex items-center justify-center">
            {sourceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No source logs found.</div>
            )}
          </div>
          <div className="space-y-2 mt-4">
            {sourceData.map(d => {
              const val = d.value;
              const total = kpis.total;
              const pct = total ? ((val / total) * 100).toFixed(1) : '0';
              return (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-semibold text-brand-text2">{d.name}</span>
                  </div>
                  <span className="font-bold text-brand-text">{formatNumber(val)} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Pie */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Walk-in vs FA-Driven</span>
          </div>
          <div className="h-[180px] w-full flex items-center justify-center">
            {channelData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No channel logs found.</div>
            )}
          </div>
          <div className="space-y-2 mt-4">
            {channelData.map(d => {
              const val = d.value;
              const total = kpis.total;
              const pct = total ? ((val / total) * 100).toFixed(1) : '0';
              return (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-semibold text-brand-text2">{d.name}</span>
                  </div>
                  <span className="font-bold text-brand-text">{formatNumber(val)} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* State Map Container */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-bg pb-4 mb-4 gap-2">
          <div>
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">State-wise Distribution Map</span>
            <span className="text-[10px] text-brand-text3 block mt-0.5">Click markers to filter dashboard state parameters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 bg-brand-green/10 text-brand-green rounded-full border border-brand-green/20">
              <span className="w-1.5 h-1.5 bg-brand-green rounded-full" />
              UP Target
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 bg-brand-orange/10 text-brand-orange rounded-full border border-brand-orange/20">
              <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
              Chhattisgarh Target
            </span>
          </div>
        </div>

        <div className="h-[420px] w-full rounded-xl overflow-hidden relative z-10 border border-brand-bg">
          <MapContainer center={[24.2, 81.0]} zoom={5} minZoom={4} maxZoom={9} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {mapMarkers.map(m => {
              const color = m.isTarget ? (m.state === 'Uttar Pradesh' ? '#1A7A3C' : '#E8620A') : '#1565C0';
              const markerIcon = L.divIcon({
                className: '',
                html: `<div class="map-marker-div" style="border-color:${color};color:${color};width:60px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:white;border-radius:50%;font-size:10px;font-weight:bold;">
                  <span style="font-size:14px;font-weight:900;line-height:1">${m.counts.yes > 999 ? Math.round(m.counts.yes / 1000) + 'k' : m.counts.yes}</span>
                  <span style="font-size:8px;font-weight:700;text-transform:uppercase;opacity:0.8">${m.rate}% apr</span>
                </div>`,
                iconSize: [60, 60],
                iconAnchor: [30, 30]
              });

              return (
                <Marker
                  key={m.state}
                  position={m.coords}
                  icon={markerIcon}
                  eventHandlers={{
                    click: () => {
                      setFilters(prev => ({ ...prev, state: m.state }));
                    }
                  }}
                >
                  <Popup>
                    <div className="w-[240px] text-brand-text">
                      <div className="bg-gradient-to-r from-brand-green to-brand-green2 px-4 py-3 text-white flex items-center justify-between">
                        <span className="font-extrabold text-sm tracking-tight">{m.state}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-white/20 rounded-full">
                          {m.isTarget ? '🎯 Target' : 'Region'}
                        </span>
                      </div>
                      <div className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-brand-bg pb-1.5">
                          <span className="font-semibold text-brand-text2">✅ Approved Scans</span>
                          <span className="font-extrabold text-brand-green">{formatNumber(m.counts.yes)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-brand-bg pb-1.5">
                          <span className="font-semibold text-brand-text2">⏳ Pending Review</span>
                          <span className="font-extrabold text-brand-orange">{formatNumber(m.counts.pending)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-brand-bg pb-1.5">
                          <span className="font-semibold text-brand-text2">❌ Rejected Scans</span>
                          <span className="font-extrabold text-red-600">{formatNumber(m.counts.no)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-brand-bg pb-1.5 font-bold">
                          <span className="text-brand-text">📊 Total Volume</span>
                          <span className="text-brand-text">{formatNumber(m.counts.total)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 font-black text-brand-green">
                          <span>🎯 Approval Rate</span>
                          <span>{m.rate}%</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

// ── 7. FA Performance TAB COMPONENT ────────────────────────
function FATab({ data }) {
  const faArr = useMemo(() => {
    const faMap = {};
    data.scans.forEach(r => {
      const name = trimStr(r.pt);
      if (!name) return;
      if (!faMap[name]) faMap[name] = { yes: 0, no: 0, pending: 0 };
      const s = trimStr(r.submissionStatus).toLowerCase();
      if (s === 'yes') faMap[name].yes++;
      else if (s === 'no') faMap[name].no++;
      else if (s === 'pending') faMap[name].pending++;
    });

    return Object.entries(faMap)
      .map(([name, d]) => ({
        name,
        total: d.yes + d.no + d.pending,
        yes: d.yes,
        no: d.no,
        pending: d.pending,
        rate: (d.yes + d.no + d.pending) ? Math.round((d.yes / (d.yes + d.no + d.pending)) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [data.scans]);

  const top15 = useMemo(() => faArr.slice(0, 15), [faArr]);

  const totals = useMemo(() => {
    const count = faArr.length;
    const avg = count ? Math.round(faArr.reduce((s, x) => s + x.total, 0) / count) : 0;
    const top = count ? faArr[0].total : 0;
    return { count, avg, top };
  }, [faArr]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-brand-text3/20 pb-4">
        <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
        <h2 className="text-xl font-extrabold text-brand-text tracking-tight">Field Assistant Performance</h2>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{totals.count}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Total active FAs</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{totals.avg}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Avg Leads Generated</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{totals.top}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Top Promoter Leads</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* FA Leads Stack Bar Chart */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">FA-wise Lead Generation (Top 15)</span>
          </div>
          <div className="h-[280px] w-full">
            {top15.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top15} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="yes" name="Approved" stackId="a" fill="#1A7A3C" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill="#C97D10" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="no" name="Rejected" stackId="a" fill="#C0392B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

        {/* FA Approval Rate Chart */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Promoter Approval Rate Breakdown</span>
          </div>
          <div className="h-[280px] w-full">
            {top15.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top15} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="rate" name="Approval Rate %" fill="#1A7A3C" radius={[4, 4, 0, 0]}>
                    {top15.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

      </div>

      {/* FA Performance Table */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">FA Performance Details</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-brand-bg">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-text3/20">
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">#</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Promoter Name</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Total Leads</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approved</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Pending</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Rejected</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {faArr.map((fa, i) => (
                <tr key={fa.name} className="border-b border-brand-bg hover:bg-brand-green/5 transition-all font-semibold">
                  <td className="p-3 font-mono text-brand-text3">{i + 1}</td>
                  <td className="p-3 font-black text-brand-text">{fa.name}</td>
                  <td className="p-3 font-mono">{formatNumber(fa.total)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-green/10 text-brand-green rounded-full">{formatNumber(fa.yes)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-orange/15 text-brand-orange rounded-full">{formatNumber(fa.pending)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full">{formatNumber(fa.no)}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-brand-bg rounded-full overflow-hidden">
                        <div className="h-full bg-brand-green rounded-full" style={{ width: `${fa.rate}%` }} />
                      </div>
                      <span className="font-mono text-brand-green">{fa.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 8. RETAILER ANALYTICS COMPONENT ───────────────────────
function RetailerTab({ data }) {
  const retArr = useMemo(() => {
    const retMap = {};
    data.scans.forEach(r => {
      const name = trimStr(r.retailerName) || '(Unknown)';
      const rin = trimStr(r.rin) || '—';
      const key = `${name}|${rin}`;
      if (!retMap[key]) retMap[key] = { name, rin, yes: 0, no: 0, pending: 0, qty: 0 };
      
      const s = trimStr(r.submissionStatus).toLowerCase();
      if (s === 'yes') retMap[key].yes++;
      else if (s === 'no') retMap[key].no++;
      else if (s === 'pending') retMap[key].pending++;

      retMap[key].qty += parseCartItems(r.cartItems).reduce((acc, it) => acc + it.qty, 0);
    });

    return Object.values(retMap)
      .map(x => ({
        ...x,
        total: x.yes + x.no + x.pending,
        rate: (x.yes + x.no + x.pending) ? Math.round((x.yes / (x.yes + x.no + x.pending)) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [data.scans]);

  const top12 = useMemo(() => retArr.slice(0, 12), [retArr]);

  const totals = useMemo(() => {
    const count = retArr.length;
    const volume = retArr.reduce((s, x) => s + x.total, 0);
    const approved = retArr.reduce((s, x) => s + x.yes, 0);
    return { count, volume, approved };
  }, [retArr]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-brand-text3/20 pb-4">
        <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
        <h2 className="text-xl font-extrabold text-brand-text tracking-tight">Retailer Analytics</h2>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{totals.count}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Active Dealers</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(totals.volume)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Redemption Volumes</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <span className="text-3xl font-black text-brand-text tracking-tight block leading-none">{formatNumber(totals.approved)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Approved Orders</span>
        </div>
      </div>

      {/* Bar charts top retailers */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Retailer Redemptions & Approvals (Top 12)</span>
        </div>
        <div className="h-[280px] w-full">
          {top12.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top12} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                <XAxis dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="yes" name="Approved" stackId="r" fill="#1A7A3C" />
                <Bar dataKey="pending" name="Pending" stackId="r" fill="#C97D10" />
                <Bar dataKey="no" name="Rejected" stackId="r" fill="#C0392B" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-brand-text3">No records found.</div>
          )}
        </div>
      </div>

      {/* Detailed Retailer table */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Authorized Dealer Registry</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-brand-bg">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-text3/20">
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">#</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Retailer Name</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">RIN ID</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Total Submissions</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approved</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Pending</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Rejected</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Qty Redeemed</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {retArr.map((ret, i) => (
                <tr key={`${ret.name}-${ret.rin}`} className="border-b border-brand-bg hover:bg-brand-green/5 transition-all font-semibold">
                  <td className="p-3 font-mono text-brand-text3">{i + 1}</td>
                  <td className="p-3 font-black text-brand-text">{ret.name}</td>
                  <td className="p-3 font-mono text-brand-text3">{ret.rin}</td>
                  <td className="p-3 font-mono">{formatNumber(ret.total)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-green/10 text-brand-green rounded-full">{formatNumber(ret.yes)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-orange/15 text-brand-orange rounded-full">{formatNumber(ret.pending)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full">{formatNumber(ret.no)}</span></td>
                  <td className="p-3 font-mono text-brand-green">{formatNumber(ret.qty)} Kg</td>
                  <td className="p-3 font-mono text-brand-green">{ret.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── 9. DISTRICT INSIGHTS COMPONENT ────────────────────────
function DistrictTab({ data }) {
  const dArr = useMemo(() => {
    const dMap = {};
    data.scans.forEach(r => {
      const d = trimStr(r.district) || 'Unknown';
      if (!dMap[d]) dMap[d] = { yes: 0, no: 0, pending: 0, phones: new Set(), rins: new Set(), dates: {} };
      
      const s = trimStr(r.submissionStatus).toLowerCase();
      if (s === 'yes') dMap[d].yes++;
      else if (s === 'no') dMap[d].no++;
      else if (s === 'pending') dMap[d].pending++;

      if (trimStr(r.phone)) dMap[d].phones.add(trimStr(r.phone));
      if (trimStr(r.rin)) dMap[d].rins.add(trimStr(r.rin));

      const dk = toDateKey(r.scanDate);
      if (dk) dMap[d].dates[dk] = (dMap[d].dates[dk] || 0) + 1;
    });

    return Object.entries(dMap).map(([name, d]) => ({
      name,
      ...d,
      total: d.yes + d.no + d.pending,
      rate: (d.yes + d.no + d.pending) ? Math.round((d.yes / (d.yes + d.no + d.pending)) * 100) : 0,
      uniqueFarmersCount: d.phones.size,
      activeDealersCount: d.rins.size
    })).sort((a, b) => b.total - a.total);
  }, [data.scans]);

  const top5 = useMemo(() => dArr.slice(0, 5), [dArr]);
  const allDates = useMemo(() => [...new Set(data.scans.map(r => toDateKey(r.scanDate)).filter(Boolean))].sort(), [data.scans]);

  // District Daily Performance Trend
  const districtTrendData = useMemo(() => {
    return allDates.map(date => {
      const row = { date };
      top5.forEach(d => {
        row[d.name] = d.dates[date] || 0;
      });
      return row;
    });
  }, [allDates, top5]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-brand-text3/20 pb-4">
        <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
        <h2 className="text-xl font-extrabold text-brand-text tracking-tight">District Insights</h2>
      </div>

      {/* Multi line chart top 5 districts */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">District-level Daily Scan Volumes (Top 5)</span>
        </div>
        <div className="h-[280px] w-full">
          {districtTrendData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={districtTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                <XAxis dataKey="date" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                <Tooltip />
                <Legend />
                {top5.map((d, idx) => (
                  <Area
                    key={d.name}
                    type="monotone"
                    dataKey={d.name}
                    stroke={PALETTE[idx % PALETTE.length]}
                    fillOpacity={0.03}
                    fill={PALETTE[idx % PALETTE.length]}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-brand-text3">No records found.</div>
          )}
        </div>
      </div>

      {/* Bottom dual charts district comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* District horizontal bar volumes */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Scan Volume by District</span>
          </div>
          <div className="h-[280px] w-full">
            {dArr.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dArr.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis type="number" tick={{ fill: '#4B6356', fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total Scans" fill="#1A7A3C" radius={[0, 4, 4, 0]}>
                    {dArr.slice(0, 10).map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

        {/* District approval rate */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">District Approval Rates</span>
          </div>
          <div className="h-[280px] w-full">
            {dArr.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dArr.slice(0, 10)} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="rate" name="Approval Rate %" fill="#1A7A3C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

      </div>

      {/* District detailed Summary Table */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Regional Performance Summary</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-brand-bg">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-text3/20">
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">District</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Total Volume</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approved</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Pending</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Rejected</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approval Rate</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Farmers</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Dealers</th>
              </tr>
            </thead>
            <tbody>
              {dArr.map(d => (
                <tr key={d.name} className="border-b border-brand-bg hover:bg-brand-green/5 transition-all font-semibold">
                  <td className="p-3 font-black text-brand-text flex items-center justify-between gap-2">
                    <span>{d.name}</span>
                    {TARGET_DISTRICTS.includes(d.name) && (
                      <span className="px-2 py-0.5 bg-brand-green/10 text-brand-green border border-brand-green/20 rounded text-[9px] font-black uppercase tracking-wider">Target</span>
                    )}
                  </td>
                  <td className="p-3 font-mono">{formatNumber(d.total)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-green/10 text-brand-green rounded-full">{formatNumber(d.yes)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-brand-orange/15 text-brand-orange rounded-full">{formatNumber(d.pending)}</span></td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full">{formatNumber(d.no)}</span></td>
                  <td className="p-3 font-mono text-brand-green">{d.rate}%</td>
                  <td className="p-3 font-mono text-brand-text3">{formatNumber(d.uniqueFarmersCount)}</td>
                  <td className="p-3 font-mono text-brand-text3">{formatNumber(d.activeDealersCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── 10. SKU PRODUCT ANALYSIS COMPONENT ───────────────────
function SKUTab({ data }) {
  const skuMap = useMemo(() => {
    const sMap = {};
    data.scans.forEach(r => {
      const approved = /^yes$/i.test(r.submissionStatus);
      parseCartItems(r.cartItems).forEach(({ name, qty, unit }) => {
        const key = `${name}|${unit || ''}`;
        if (!sMap[key]) {
          sMap[key] = { name, unit, qty: 0, count: 0, approvedQty: 0 };
        }
        sMap[key].qty += qty;
        sMap[key].count++;
        if (approved) {
          sMap[key].approvedQty += qty;
        }
      });
    });
    return Object.values(sMap).sort((a, b) => b.qty - a.qty);
  }, [data.scans]);

  const grandTotalQty = useMemo(() => skuMap.reduce((s, x) => s + x.qty, 0), [skuMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-brand-text3/20 pb-4">
        <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
        <h2 className="text-xl font-extrabold text-brand-text tracking-tight">Product SKU Insights</h2>
      </div>

      {/* Grid SKU inventory cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {skuMap.map((s, idx) => (
          <div key={`${s.name}-${s.unit}`} className="bg-white border border-brand-text3/25 rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden">
            <div className="w-1 h-full bg-gradient-to-b from-brand-green to-brand-orange absolute left-0 top-0" />
            <h3 className="font-extrabold text-xs text-brand-text tracking-tight leading-tight truncate">{s.name}</h3>
            <span className="text-[10px] text-brand-text3 block mt-0.5 font-bold">{s.unit || 'Mixed pack'}</span>
            <span className="text-2xl font-black text-brand-green mt-3.5 block leading-none">{formatNumber(s.qty)}</span>
            <span className="text-[9px] text-brand-text2 font-semibold tracking-wider block mt-1.5 uppercase">{s.count} orders placed</span>
          </div>
        ))}
      </div>

      {/* SKU volume bar comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Qty Volumes */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Product Volume (Total Quantity Sold)</span>
          </div>
          <div className="h-[280px] w-full">
            {skuMap.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skuMap} layout="vertical" margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis type="number" tick={{ fill: '#4B6356', fontSize: 9 }} />
                  <YAxis type="category" dataKey={x => x.name + (x.unit ? ` (${x.unit})` : '')} tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="qty" name="Qty (units)" fill="#1A7A3C" radius={[0, 4, 4, 0]}>
                    {skuMap.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

        {/* Freq bar */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Product Frequency (Order Frequency)</span>
          </div>
          <div className="h-[280px] w-full">
            {skuMap.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skuMap} layout="vertical" margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis type="number" tick={{ fill: '#4B6356', fontSize: 9 }} />
                  <YAxis type="category" dataKey={x => x.name + (x.unit ? ` (${x.unit})` : '')} tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Frequency (Orders)" fill="#E8620A" radius={[0, 4, 4, 0]}>
                    {skuMap.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE[(idx + 3) % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

      </div>

      {/* SKU Table list */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">SKU Purchase Registry</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-brand-bg">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-text3/20">
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Product Name</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Variant</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Total Qty</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Order Count</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Approved Qty</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">% of total Share</th>
              </tr>
            </thead>
            <tbody>
              {skuMap.map(s => (
                <tr key={`${s.name}-${s.unit}`} className="border-b border-brand-bg hover:bg-brand-green/5 transition-all font-semibold">
                  <td className="p-3 font-black text-brand-text">{s.name}</td>
                  <td className="p-3 font-semibold text-brand-text2">{s.unit || '—'}</td>
                  <td className="p-3 font-mono">{formatNumber(s.qty)}</td>
                  <td className="p-3 font-mono text-brand-text3">{formatNumber(s.count)}</td>
                  <td className="p-3 font-mono text-brand-green">{formatNumber(s.approvedQty)}</td>
                  <td className="p-3 font-mono text-brand-orange">{grandTotalQty ? ((s.qty / grandTotalQty) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── 11. REPEAT GROWER LOYALTY COMPONENT ──────────────────
function RepeatTab({ data }) {
  const repeatFarmers = useMemo(() => {
    const growerMap = {};
    data.scans.forEach(r => {
      const ph = trimStr(r.phone);
      if (!ph) return;
      if (!growerMap[ph]) {
        growerMap[ph] = {
          phone: ph,
          name: `${trimStr(r.firstName)} ${trimStr(r.lastName)}`.trim() || '—',
          district: trimStr(r.district) || '—',
          dates: [],
          products: new Set(),
          statuses: []
        };
      }
      growerMap[ph].dates.push(toDateKey(r.scanDate) || '');
      growerMap[ph].statuses.push(trimStr(r.submissionStatus));
      parseCartItems(r.cartItems).forEach(i => growerMap[ph].products.add(i.name));
    });

    return Object.values(growerMap)
      .filter(f => f.dates.length > 1)
      .sort((a, b) => b.dates.length - a.dates.length);
  }, [data.scans]);

  const totals = useMemo(() => {
    const count = repeatFarmers.length;
    const totalTx = repeatFarmers.reduce((s, f) => s + f.dates.length, 0);
    const avg = count ? (totalTx / count).toFixed(1) : '0.0';
    return { count, totalTx, avg };
  }, [repeatFarmers]);

  // Repeat growers transaction distribution
  const freqData = useMemo(() => {
    const dist = {};
    repeatFarmers.forEach(f => {
      const count = f.dates.length;
      dist[count] = (dist[count] || 0) + 1;
    });
    return Object.entries(dist).map(([tx, count]) => ({
      name: `${tx} scans`,
      Farmers: count
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [repeatFarmers]);

  // Repeat grower monthly registration trend
  const monthData = useMemo(() => {
    const mData = {};
    repeatFarmers.forEach(f => {
      f.dates.forEach(d => {
        if (!d) return;
        const mKey = d.slice(0, 7); // YYYY-MM
        if (!mData[mKey]) mData[mKey] = new Set();
        mData[mKey].add(f.phone);
      });
    });
    return Object.entries(mData).map(([month, subset]) => ({
      month,
      Interactions: subset.size
    })).sort((a, b) => a.month.localeCompare(b.month));
  }, [repeatFarmers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-brand-text3/20 pb-4">
        <span className="w-1.5 h-6 bg-gradient-to-b from-brand-green to-brand-green2 rounded-full" />
        <h2 className="text-xl font-extrabold text-brand-text tracking-tight">Customer Retention & Repeat Farmers</h2>
      </div>

      {/* Retentions metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm text-center">
          <span className="text-3xl font-black text-brand-green tracking-tight block leading-none">{formatNumber(totals.count)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Repeat Growers</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm text-center">
          <span className="text-3xl font-black text-brand-green tracking-tight block leading-none">{formatNumber(totals.totalTx)}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Loyalty transactions</span>
        </div>
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm text-center">
          <span className="text-3xl font-black text-brand-green tracking-tight block leading-none">{totals.avg}</span>
          <span className="text-[10px] font-bold text-brand-text2 uppercase tracking-widest block mt-1.5">Average Scans per Repeat</span>
        </div>
      </div>

      {/* Retention Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Frequency bar */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Transaction Frequency Distribution</span>
          </div>
          <div className="h-[260px] w-full">
            {freqData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="name" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="Farmers" name="Farmers" fill="#1A7A3C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

        {/* Monthly line trend */}
        <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-brand-bg pb-3 mb-4">
            <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Monthly Repeat Interactions</span>
          </div>
          <div className="h-[260px] w-full">
            {monthData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoyalty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B21A8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6B21A8" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                  <XAxis dataKey="month" tick={{ fill: '#4B6356', fontSize: 9, fontWeight: 600 }} />
                  <YAxis tick={{ fill: '#4B6356', fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Interactions" stroke="#6B21A8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLoyalty)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-brand-text3">No records found.</div>
            )}
          </div>
        </div>

      </div>

      {/* Repeat Grower details */}
      <div className="bg-white border border-brand-text3/25 rounded-2xl p-5 shadow-sm">
        <div className="border-b border-brand-bg pb-3 mb-4">
          <span className="text-xs font-black text-brand-text2 uppercase tracking-wider block">Loyal Grower Registry</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-brand-bg">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-text3/20">
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Grower Phone</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Grower Name</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">District</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Total Interactions</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">First Scan Date</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Last Scan Date</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Purchases</th>
                <th className="p-3 font-bold uppercase tracking-wider text-brand-text2">Last Status</th>
              </tr>
            </thead>
            <tbody>
              {repeatFarmers.slice(0, 100).map(f => {
                const sortedDates = f.dates.filter(Boolean).sort();
                const latestStatus = f.statuses[f.statuses.length - 1] || '—';
                const statusBadgeClass = /yes/i.test(latestStatus)
                  ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                  : /no/i.test(latestStatus)
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-brand-orange/15 text-brand-orange border-brand-orange/20';

                return (
                  <tr key={f.phone} className="border-b border-brand-bg hover:bg-brand-green/5 transition-all font-semibold">
                    <td className="p-3 font-mono text-brand-text">{f.phone}</td>
                    <td className="p-3 font-black text-brand-text">{f.name}</td>
                    <td className="p-3 font-semibold text-brand-text2">{f.district}</td>
                    <td className="p-3 font-mono text-brand-green font-extrabold text-sm">{f.dates.length}</td>
                    <td className="p-3 font-mono text-brand-text3">{sortedDates[0] || '—'}</td>
                    <td className="p-3 font-mono text-brand-text3">{sortedDates[sortedDates.length - 1] || '—'}</td>
                    <td className="p-3 text-[10px] max-w-[200px] truncate text-brand-text2">{[...f.products].join(', ') || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 border rounded-full text-[10px] font-bold ${statusBadgeClass}`}>
                        {latestStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
