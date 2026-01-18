import Dashboard from "./dashboard";
// // src/App.tsx
// import { useQuery } from '@tanstack/react-query';
// import { getStats, getAccounts, getLogs } from './lib/api';
// import StatsCard from './components/StatsCard';
// import AccountsTable from './components/AccountsTable';

// function App() {
//   const { data: stats } = useQuery({
//     queryKey: ['stats'],
//     queryFn: getStats,
//     refetchInterval: 30000, // Refresh every 30s
//   });

//   const { data: accounts } = useQuery({
//     queryKey: ['accounts'],
//     queryFn: getAccounts,
//     refetchInterval: 30000,
//   });

//   return (
//     <div className="min-h-screen bg-gray-50 p-8">
//       <header className="mb-8">
//         <h1 className="text-4xl font-bold">Kora Rent Reclaimer</h1>
//         <p className="text-gray-600">Monitor and reclaim locked rent SOL</p>
//       </header>

//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//         <StatsCard
//           title="Monitoring"
//           value={stats?.data.monitoring || 0}
//           icon="eye"
//           color="blue"
//         />
//         <StatsCard
//           title="Reclaimed"
//           value={stats?.data.reclaimed || 0}
//           icon="check"
//           color="green"
//         />
//         <StatsCard
//           title="Errors"
//           value={stats?.data.errors || 0}
//           icon="alert"
//           color="red"
//         />
//       </div>

//       {/* Accounts Table */}
//       <AccountsTable accounts={accounts?.data || []} />
//     </div>
//   );
// }

// export default App;

export default function App() {
  return (
    <Dashboard />
  )
}