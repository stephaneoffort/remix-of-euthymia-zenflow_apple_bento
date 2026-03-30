export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  type: 'public' | 'private' | 'dm';
  space_id: string | null;
  created_by: string | null;
  is_archived: boolean;
  position: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'file' | 'system' | 'task_link';
  thread_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  mentioned_users: string[] | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
}

export interface UserPresence {
  id: string;
  user_id: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  last_seen: string;
  custom_status: string | null;
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  avatar_url: string | null;
  role: string;
}
