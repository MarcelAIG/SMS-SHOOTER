export const getBadgeColors = (status: string) => {
  switch (status) {
    case 'INTERESTED': return 'bg-green-500/20 text-green-400 border-green-500/50';
    case 'NOT INTERESTED': return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'FOLLOW UP NEEDED': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    case 'CALL BOOKED': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    default: return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  }
};

export const getColumnColors = (status: string) => {
  switch (status) {
    case 'INTERESTED': return 'border-t-green-500/50';
    case 'NOT INTERESTED': return 'border-t-red-500/50';
    case 'FOLLOW UP NEEDED': return 'border-t-blue-500/50';
    case 'CALL BOOKED': return 'border-t-purple-500/50';
    default: return 'border-t-neutral-800';
  }
};
