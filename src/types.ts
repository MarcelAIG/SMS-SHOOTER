export interface Contact {
  id: string;
  businessName: string;
  phone: string;
  firstName?: string;
  notes?: string;
  status: 'NOT INTERESTED' | 'INTERESTED' | 'FOLLOW UP NEEDED' | 'CALL BOOKED';
  dateAdded: number;
  lastMessageAt: number;
  followUpStage: number;
  nextFollowUpAt: number | null;
}

export interface Message {
  id: string;
  twilioSid: string;
  contactId: string;
  from: string;
  to: string;
  body: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  createdAt: number;
  errorCode: string | null;
  errorMessage: string | null;
  isInitial: boolean;
  read?: boolean;
}

export interface CampaignSettings {
  delaySeconds: number;
  initialMessage: string;
  followUp1Message: string;
  followUp1Days: number;
  followUp2Message: string;
  followUp2Days: number;
}

export interface Campaign {
  id: string;
  name: string;
  timezone: string;
  scheduledStart: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  endDate: number | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'CANCELLED' | 'FAILED';
  createdAt: number;
  
  // Campaign-specific sequence options
  initialMessage?: string;
  followUp1Message?: string;
  followUp1DelayMinutes?: number;
  followUp2Message?: string;
  followUp2DelayMinutes?: number;
  
  // Options
  sendIntervalMinutes?: number;
  stopOnReply?: boolean;
  allowFollowUps?: boolean;
  skipDuplicates?: boolean;
  
  // Schedule
  activeDays?: string[];
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'Pending' | 'Scheduled' | 'Queued' | 'Sent' | 'Delivered' | 'Failed' | 'Cancelled' | 'Skipped';
  queuedAt?: number;
  sentAt?: number | null;
}


