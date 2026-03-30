export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          id: string
          name: string
          task_id: string
          url: string
        }
        Insert: {
          id?: string
          name: string
          task_id: string
          url: string
        }
        Update: {
          id?: string
          name?: string
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      brevo_campaigns: {
        Row: {
          campaign_id: number
          click_rate: number | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          name: string
          open_rate: number | null
          scheduled_at: string | null
          sent_count: number | null
          status: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          campaign_id: number
          click_rate?: number | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          name: string
          open_rate?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: number
          click_rate?: number | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          name?: string
          open_rate?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brevo_connections: {
        Row: {
          account_email: string | null
          account_name: string | null
          api_key: string
          created_at: string | null
          id: string
          plan: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_name?: string | null
          api_key: string
          created_at?: string | null
          id?: string
          plan?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_name?: string | null
          api_key?: string
          created_at?: string | null
          id?: string
          plan?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brevo_contacts: {
        Row: {
          attributes: Json | null
          brevo_contact_id: number | null
          created_at: string | null
          email: string
          entity_id: string
          entity_type: string
          first_name: string | null
          id: string
          last_name: string | null
          list_ids: number[] | null
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          brevo_contact_id?: number | null
          created_at?: string | null
          email: string
          entity_id: string
          entity_type: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          list_ids?: number[] | null
          user_id: string
        }
        Update: {
          attributes?: Json | null
          brevo_contact_id?: number | null
          created_at?: string | null
          email?: string
          entity_id?: string
          entity_type?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          list_ids?: number[] | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_accounts: {
        Row: {
          access_token: string | null
          caldav_password: string | null
          caldav_url: string | null
          caldav_username: string | null
          calendar_id: string | null
          color: string | null
          created_at: string | null
          ics_url: string | null
          id: string
          is_active: boolean | null
          label: string | null
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          token_expiry: string | null
          user_id: string | null
          zenflow_calendar_id: string | null
        }
        Insert: {
          access_token?: string | null
          caldav_password?: string | null
          caldav_url?: string | null
          caldav_username?: string | null
          calendar_id?: string | null
          color?: string | null
          created_at?: string | null
          ics_url?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          token_expiry?: string | null
          user_id?: string | null
          zenflow_calendar_id?: string | null
        }
        Update: {
          access_token?: string | null
          caldav_password?: string | null
          caldav_url?: string | null
          caldav_username?: string | null
          calendar_id?: string | null
          color?: string | null
          created_at?: string | null
          ics_url?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          token_expiry?: string | null
          user_id?: string | null
          zenflow_calendar_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          account_id: string | null
          conference_id: string | null
          created_at: string | null
          description: string | null
          end_time: string
          external_id: string | null
          has_meet: boolean | null
          id: string
          is_all_day: boolean | null
          last_synced_at: string | null
          location: string | null
          meet_link: string | null
          provider: string
          start_time: string
          status: string | null
          sync_status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          conference_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          external_id?: string | null
          has_meet?: boolean | null
          id?: string
          is_all_day?: boolean | null
          last_synced_at?: string | null
          location?: string | null
          meet_link?: string | null
          provider?: string
          start_time: string
          status?: string | null
          sync_status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          conference_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          external_id?: string | null
          has_meet?: boolean | null
          id?: string
          is_all_day?: boolean | null
          last_synced_at?: string | null
          location?: string | null
          meet_link?: string | null
          provider?: string
          start_time?: string
          status?: string | null
          sync_status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_attachments: {
        Row: {
          created_at: string | null
          design_id: string
          design_name: string
          design_type: string | null
          design_url: string
          entity_id: string
          entity_type: string
          id: string
          thumbnail_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          design_id: string
          design_name: string
          design_type?: string | null
          design_url: string
          entity_id: string
          entity_type: string
          id?: string
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          design_id?: string
          design_name?: string
          design_type?: string | null
          design_url?: string
          entity_id?: string
          entity_type?: string
          id?: string
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      canva_connections: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          refresh_token: string
          token_expiry: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token?: string
          token_expiry?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          author_id: string
          category_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id: string
          category_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id?: string
          category_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "chat_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          member_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          member_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          member_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_status: {
        Row: {
          category_id: string
          last_read_at: string
          member_id: string
        }
        Insert: {
          category_id: string
          last_read_at?: string
          member_id: string
        }
        Update: {
          category_id?: string
          last_read_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_status_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "chat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_status_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_statuses: {
        Row: {
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      direct_conversation_members: {
        Row: {
          conversation_id: string
          member_id: string
        }
        Insert: {
          conversation_id: string
          member_id: string
        }
        Update: {
          conversation_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversation_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          author_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          member_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          member_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          member_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_reactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_read_status: {
        Row: {
          conversation_id: string
          last_read_at: string
          member_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          member_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_read_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_read_status_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_attachments: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          file_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          file_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          file_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      drive_connections: {
        Row: {
          access_token: string
          created_at: string | null
          email: string | null
          id: string
          refresh_token: string
          token_expiry: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          email?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          email?: string | null
          id?: string
          refresh_token?: string
          token_expiry?: string
          user_id?: string
        }
        Relationships: []
      }
      filter_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          member_id: string
          name: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          member_id: string
          name: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          member_id?: string
          name?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          refresh_token: string
          token_expiry: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token?: string
          token_expiry?: string
          user_id?: string
        }
        Relationships: []
      }
      member_integrations: {
        Row: {
          connected_at: string | null
          created_at: string | null
          enabled_at: string | null
          id: string
          integration: string
          is_connected: boolean | null
          is_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          enabled_at?: string | null
          id?: string
          integration: string
          is_connected?: boolean | null
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          enabled_at?: string | null
          id?: string
          integration?: string
          is_connected?: boolean | null
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          team_member_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          team_member_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          member_id: string
          project_id: string
        }
        Insert: {
          member_id: string
          project_id: string
        }
        Update: {
          member_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          space_id: string
        }
        Insert: {
          color: string
          id: string
          is_archived?: boolean
          name: string
          sort_order?: number
          space_id: string
        }
        Update: {
          color?: string
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          member_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          member_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          member_id?: string
          p256dh?: string
        }
        Relationships: []
      }
      space_managers: {
        Row: {
          member_id: string
          space_id: string
        }
        Insert: {
          member_id: string
          space_id: string
        }
        Update: {
          member_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_managers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_managers_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          member_id: string
          space_id: string
        }
        Insert: {
          member_id: string
          space_id: string
        }
        Update: {
          member_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          icon: string
          id: string
          is_archived: boolean
          is_private: boolean
          name: string
          owner_member_id: string | null
          sort_order: number
        }
        Insert: {
          icon: string
          id: string
          is_archived?: boolean
          is_private?: boolean
          name: string
          owner_member_id?: string | null
          sort_order?: number
        }
        Update: {
          icon?: string
          id?: string
          is_archived?: boolean
          is_private?: boolean
          name?: string
          owner_member_id?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          member_id: string
          task_id: string
        }
        Insert: {
          member_id: string
          task_id: string
        }
        Update: {
          member_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          id: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          created_at: string
          id: string
          offset_key: string
          reminder_type: string
          task_id: string
          triggered_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          offset_key: string
          reminder_type: string
          task_id: string
          triggered_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          offset_key?: string
          reminder_type?: string
          task_id?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_summary: string | null
          created_at: string
          description: string
          due_date: string | null
          google_event_id: string | null
          id: string
          list_id: string
          parent_task_id: string | null
          priority: string
          recurrence: string | null
          recurrence_end_date: string | null
          sort_order: number
          start_date: string | null
          status: string
          tags: string[]
          target_calendar_id: string | null
          time_estimate: number | null
          time_logged: number | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          google_event_id?: string | null
          id?: string
          list_id: string
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_end_date?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          tags?: string[]
          target_calendar_id?: string | null
          time_estimate?: number | null
          time_logged?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          google_event_id?: string | null
          id?: string
          list_id?: string
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_end_date?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          tags?: string[]
          target_calendar_id?: string | null
          time_estimate?: number | null
          time_logged?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_color: string
          avatar_url: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          avatar_color: string
          avatar_url?: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Update: {
          avatar_color?: string
          avatar_url?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sync_preferences: {
        Row: {
          auto_sync_subtasks: boolean | null
          auto_sync_tasks: boolean | null
          created_at: string | null
          id: string
          sync_tasks_without_date: boolean | null
          task_calendar_id: string | null
          task_calendar_label: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_sync_subtasks?: boolean | null
          auto_sync_tasks?: boolean | null
          created_at?: string | null
          id?: string
          sync_tasks_without_date?: boolean | null
          task_calendar_id?: string | null
          task_calendar_label?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_sync_subtasks?: boolean | null
          auto_sync_tasks?: boolean | null
          created_at?: string | null
          id?: string
          sync_tasks_without_date?: boolean | null
          task_calendar_id?: string | null
          task_calendar_label?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zoom_connections: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          refresh_token: string
          token_expiry: string
          user_id: string
          zoom_user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          user_id: string
          zoom_user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          refresh_token?: string
          token_expiry?: string
          user_id?: string
          zoom_user_id?: string | null
        }
        Relationships: []
      }
      zoom_meetings: {
        Row: {
          created_at: string | null
          duration: number | null
          entity_id: string
          entity_type: string
          id: string
          join_url: string
          notified_at: string | null
          password: string | null
          start_time: string | null
          start_url: string
          status: string | null
          topic: string
          user_id: string
          zoom_meeting_id: number
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          entity_id: string
          entity_type: string
          id?: string
          join_url: string
          notified_at?: string | null
          password?: string | null
          start_time?: string | null
          start_url: string
          status?: string | null
          topic: string
          user_id: string
          zoom_meeting_id: number
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          join_url?: string
          notified_at?: string | null
          password?: string | null
          start_time?: string | null
          start_url?: string
          status?: string | null
          topic?: string
          user_id?: string
          zoom_meeting_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_space: {
        Args: { _member_id: string; _space_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_space_manager: {
        Args: { _member_id: string; _space_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
