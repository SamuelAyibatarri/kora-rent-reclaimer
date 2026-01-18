import { useState, useEffect, useCallback } from 'react';
import { 
   Eye, CheckCircle, AlertCircle, RefreshCw, 
  TrendingUp, Clock, Copy, ExternalLink, Terminal, 
  Database, Search
} from 'lucide-react';

const API_URL = 'http://localhost:8787';

interface Account {
  address: string;
  status: string;
  balance_lamports: number;
  last_active_at: number;
  created_at: number;
  reclaimed_at?: number;
  reclaim_tx_signature?: string;
}

interface Stats {
  monitoring: number;
  reclaimed: number;
  errors: number;
  last_run: string;
}

interface LogEntry {
  id: number;
  level: string;
  message: string;
  meta: string;
  timestamp: number;
}


const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    MONITORING: 'bg-blue-50 text-blue-700 border-blue-100',
    RECLAIMED: 'bg-green-50 text-green-700 border-green-100',
    ERROR: 'bg-red-50 text-red-700 border-red-100',
    PROBATION: 'bg-purple-50 text-purple-700 border-purple-100',
    MARKED_FOR_DEATH: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
      {status}
    </span>
  );
};

function StatsCard({ title, value, icon: Icon, color, subtitle }: any) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
}


export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'logs'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success'} | null>(null);

  const notify = (msg: string, type: 'info' | 'success' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [s, a, l] = await Promise.all([
        fetch(`${API_URL}/stats`).then(res => res.json()),
        fetch(`${API_URL}/accounts`).then(res => res.json()),
        fetch(`${API_URL}/logs`).then(res => res.json()),
      ]);
      setStats(s);
      setAccounts(a);
      setLogs(l);
    } catch (e) {
      console.error("Fetch Error:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const triggerAction = async (endpoint: string, label: string) => {
    setLoading(true);
    notify(`${label} in progress...`);
    try {
      await fetch(`${API_URL}/${endpoint}`);
      await fetchData();
      notify(`${label} completed!`, 'success');
    } catch (e) {
      notify(`Error: ${label} failed`, 'info');
    } finally {
      setLoading(false);
    }
  };

  const triggerCron = async () => {
    setLoading(true);
    notify("Triggering manual cron...");
    try {
      await fetch(`${API_URL}/cdn-cgi/handler/scheduled`);
      setTimeout(async () => {
        await fetchData();
        notify("Cron cycle finished!", "success");
        setLoading(false);
      }, 2000);
    } catch (e) {
      notify("Failed to trigger Cron locally", "info");
      setLoading(false);
    }
  };

  const filteredAccounts = accounts
    .filter(acc => acc.address.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.created_at - a.created_at);

  const totalSOL = (accounts.reduce((acc, curr) => acc + curr.balance_lamports, 0) / 1e9).toFixed(4);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-4 py-2 rounded-lg shadow-lg border text-sm font-medium ${
            notification.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-gray-800 text-white border-gray-700'
          }`}>
            {notification.msg}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Kora Rent Reclaimer</h1>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => triggerAction('run-sync', 'Sync')} disabled={loading} className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={triggerCron} disabled={loading} className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2">
              <Clock size={16} /> Trigger Cron
            </button>
            <button onClick={() => triggerAction('run-reclaim', 'Reclaim')} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Database size={16} /> Reclaim All
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          {(['overview', 'accounts', 'logs'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard title="Monitoring" value={stats?.monitoring || 0} icon={Eye} color="blue" subtitle="Active targets" />
              <StatsCard title="Reclaimed" value={stats?.reclaimed || 0} icon={CheckCircle} color="green" subtitle="Success count" />
              <StatsCard title="Errors" value={stats?.errors || 0} icon={AlertCircle} color="red" subtitle="Failed attempts" />
              <StatsCard title="Total Found" value={`${totalSOL} SOL`} icon={TrendingUp} color="purple" subtitle="Rent in monitoring" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Priority Targets</h3>
                    <button onClick={() => setActiveTab('accounts')} className="text-xs text-blue-600 hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {accounts.slice(0, 5).map(acc => (
                      <div key={acc.address} className="px-6 py-4 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-gray-700">{acc.address.slice(0, 8)}...{acc.address.slice(-8)}</span>
                          <span className="text-[10px] text-gray-400">Added {new Date(acc.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">{(acc.balance_lamports / 1e9).toFixed(4)} SOL</span>
                          <StatusBadge status={acc.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-6 text-white shadow-lg border border-gray-800 h-fit">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-6 tracking-wider">Node Health</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs text-gray-400">Operator Wallet</span>
                      <span className="text-xl font-semibold text-green-400">4.995 SOL</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[95%]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 mb-1">Network</p>
                      <p className="text-sm font-medium">Devnet</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 mb-1">Status</p>
                      <p className="text-sm font-medium text-green-400">Online</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" placeholder="Search address..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[40%]">Address</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[20%]">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[25%]">Balance</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[15%] text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAccounts.map(acc => (
                    <tr key={acc.address} className="hover:bg-gray-50 group transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-700">{acc.address.slice(0, 12)}...</span>
                          <button onClick={() => {navigator.clipboard.writeText(acc.address); notify('Copied!')}} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity">
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={acc.status} /></td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{(acc.balance_lamports / 1e9).toFixed(6)} SOL</td>
                      <td className="px-6 py-4 text-right">
                        <a href={`https://explorer.solana.com/address/${acc.address}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                          Explorer <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-center gap-2">
              <Terminal size={18} className="text-blue-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System Logs</span>
            </div>
            <div className="max-h-150 overflow-y-auto font-mono p-2">
              {logs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-gray-800/50 rounded transition-colors flex flex-col gap-2 mb-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      log.level === 'ERROR' ? 'bg-red-900/40 text-red-400' : 
                      log.level === 'WARN' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-900/40 text-green-400'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-[10px] text-gray-500 italic">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-300">{log.message}</p>
                  {log.meta && log.meta !== "{}" && (
                     <div className="mt-2 bg-black/40 p-3 rounded border border-gray-800">
                        <pre className="text-xs text-blue-300/80 whitespace-pre-wrap">
                          {JSON.stringify(JSON.parse(log.meta), null, 2)}
                        </pre>
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}