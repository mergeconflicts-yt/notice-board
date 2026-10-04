export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      board_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          board_id: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          board_id: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          board_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_blocks_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_blocks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_magnets: {
        Row: {
          art_id: string
          board_id: string
          created_at: string
          gift_note: string | null
          id: string
          item_id: string | null
          pack_id: string
          placed_by: string | null
          rotation: number
          updated_at: string
          version: number
          x: number
          y: number
          z: number
        }
        Insert: {
          art_id: string
          board_id: string
          created_at?: string
          gift_note?: string | null
          id?: string
          item_id?: string | null
          pack_id: string
          placed_by?: string | null
          rotation?: number
          updated_at?: string
          version?: number
          x: number
          y: number
          z: number
        }
        Update: {
          art_id?: string
          board_id?: string
          created_at?: string
          gift_note?: string | null
          id?: string
          item_id?: string | null
          pack_id?: string
          placed_by?: string | null
          rotation?: number
          updated_at?: string
          version?: number
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_magnets_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_magnets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_magnets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "visible_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_magnets_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          board_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          board_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          theme_pack: string
          timezone: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          theme_pack?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          theme_pack?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          board_id: string
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          secret_enc: string
          token_hash: string
        }
        Insert: {
          board_id: string
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          secret_enc: string
          token_hash: string
        }
        Update: {
          board_id?: string
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          secret_enc?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          board_id: string
          body: string | null
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string
          keep_until: string | null
          layout: Json | null
          paper_style: string | null
          photo_path: string | null
          pinned: boolean
          place: string | null
          shared_from_app: string | null
          shared_from_author: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          board_id: string
          body?: string | null
          color?: Database["public"]["Enums"]["item_color"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          event_at?: string | null
          id: string
          keep_until?: string | null
          layout?: Json | null
          paper_style?: string | null
          photo_path?: string | null
          pinned?: boolean
          place?: string | null
          shared_from_app?: string | null
          shared_from_author?: string | null
          title?: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          board_id?: string
          body?: string | null
          color?: Database["public"]["Enums"]["item_color"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          event_at?: string | null
          id?: string
          keep_until?: string | null
          layout?: Json | null
          paper_style?: string | null
          photo_path?: string | null
          pinned?: boolean
          place?: string | null
          shared_from_app?: string | null
          shared_from_author?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_entries: {
        Row: {
          board_id: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          position: number
          text: string
          updated_at: string
        }
        Insert: {
          board_id: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          item_id: string
          position: number
          text: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          position?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_entries_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_entries_item_id_board_id_fkey"
            columns: ["item_id", "board_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "board_id"]
          },
          {
            foreignKeyName: "list_entries_item_id_board_id_fkey"
            columns: ["item_id", "board_id"]
            isOneToOne: false
            referencedRelation: "visible_items"
            referencedColumns: ["id", "board_id"]
          },
        ]
      }
      pack_art: {
        Row: {
          art_id: string
          h: number | null
          kind: string
          label: string
          pack_id: string
          path: string
          w: number | null
        }
        Insert: {
          art_id: string
          h?: number | null
          kind: string
          label: string
          pack_id: string
          path: string
          w?: number | null
        }
        Update: {
          art_id?: string
          h?: number | null
          kind?: string
          label?: string
          pack_id?: string
          path?: string
          w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_art_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "pack_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_catalog: {
        Row: {
          assets_version: number
          available_from: string | null
          available_until: string | null
          blurb: string | null
          bundle_of: string[] | null
          id: string
          kind: string
          min_renderer: number
          name: string
          price_label: string | null
          sort: number
          spec: Json
          status: string
          store_product_id: string | null
        }
        Insert: {
          assets_version?: number
          available_from?: string | null
          available_until?: string | null
          blurb?: string | null
          bundle_of?: string[] | null
          id: string
          kind: string
          min_renderer?: number
          name: string
          price_label?: string | null
          sort?: number
          spec?: Json
          status?: string
          store_product_id?: string | null
        }
        Update: {
          assets_version?: number
          available_from?: string | null
          available_until?: string | null
          blurb?: string | null
          bundle_of?: string[] | null
          id?: string
          kind?: string
          min_renderer?: number
          name?: string
          price_label?: string | null
          sort?: number
          spec?: Json
          status?: string
          store_product_id?: string | null
        }
        Relationships: []
      }
      photo_upload_intents: {
        Row: {
          board_id: string
          byte_size: number | null
          consumed: boolean
          created_at: string
          expires_at: string
          item_id: string
          path: string
          user_id: string
        }
        Insert: {
          board_id: string
          byte_size?: number | null
          consumed?: boolean
          created_at?: string
          expires_at?: string
          item_id: string
          path: string
          user_id: string
        }
        Update: {
          board_id?: string
          byte_size?: number | null
          consumed?: boolean
          created_at?: string
          expires_at?: string
          item_id?: string
          path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_upload_intents_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_upload_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          board_id: string
          created_at: string
          id: string
          item_id: string
          reason: string | null
          reporter_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          item_id: string
          reason?: string | null
          reporter_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          item_id?: string
          reason?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "visible_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          created_at: string
          pack_id: string
          revoked_at: string | null
          source: string
          store_txn_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          pack_id: string
          revoked_at?: string | null
          source: string
          store_txn_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          pack_id?: string
          revoked_at?: string | null
          source?: string
          store_txn_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      visible_items: {
        Row: {
          board_id: string | null
          body: string | null
          color: Database["public"]["Enums"]["item_color"] | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string | null
          keep_until: string | null
          layout: Json | null
          photo_path: string | null
          pinned: boolean | null
          place: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"] | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          board_id?: string | null
          body?: string | null
          color?: Database["public"]["Enums"]["item_color"] | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          event_at?: string | null
          id?: string | null
          keep_until?: string | null
          layout?: Json | null
          photo_path?: string | null
          pinned?: boolean | null
          place?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["item_type"] | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          board_id?: string | null
          body?: string | null
          color?: Database["public"]["Enums"]["item_color"] | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          event_at?: string | null
          id?: string | null
          keep_until?: string | null
          layout?: Json | null
          photo_path?: string | null
          pinned?: boolean | null
          place?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["item_type"] | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _consume_photo_intent: {
        Args: { p_board_id: string; p_item_id: string; p_photo_path: string }
        Returns: undefined
      }
      _path_board_id: { Args: { p_path: string }; Returns: string }
      accept_invite: {
        Args: { p_display_name?: string; p_token_or_code: string }
        Returns: string
      }
      add_entry: {
        Args: { p_id: string; p_item_id: string; p_text: string }
        Returns: {
          board_id: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          position: number
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "list_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      block_member: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: undefined
      }
      board_can_use: {
        Args: { p_board_id: string; p_pack_id: string }
        Returns: boolean
      }
      cleanup_anonymous_user: { Args: { p_id: string }; Returns: boolean }
      cleanup_rate_limits: { Args: never; Returns: number }
      create_board: {
        Args: { p_color?: string; p_name: string; p_timezone?: string }
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          theme_pack: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "boards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      default_keep_until: {
        Args: {
          p_event_at: string
          p_now: string
          p_pinned: boolean
          p_timezone: string
          p_type: Database["public"]["Enums"]["item_type"]
        }
        Returns: string
      }
      delete_account: { Args: never; Returns: undefined }
      delete_board: { Args: { p_board_id: string }; Returns: undefined }
      dismiss_reports: { Args: { p_item_id: string }; Returns: undefined }
      edit_entry: { Args: { p_id: string; p_text: string }; Returns: undefined }
      edit_item: {
        Args: {
          p_body: string
          p_color: Database["public"]["Enums"]["item_color"]
          p_event_at: string
          p_expected_version: number
          p_id: string
          p_place: string
          p_title: string
        }
        Returns: undefined
      }
      edit_list: {
        Args: {
          p_adds?: Json
          p_body?: string
          p_color: Database["public"]["Enums"]["item_color"]
          p_edits?: Json
          p_expected_version: number
          p_item_id: string
          p_removes?: string[]
          p_title: string
        }
        Returns: undefined
      }
      expire_items: { Args: never; Returns: number }
      expired_for_purge: {
        Args: { p_limit?: number }
        Returns: {
          board_id: string
          body: string | null
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string
          keep_until: string | null
          layout: Json | null
          paper_style: string | null
          photo_path: string | null
          pinned: boolean
          place: string | null
          shared_from_app: string | null
          shared_from_author: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_by: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_invite_link: {
        Args: { p_board_id: string }
        Returns: {
          code: string
          expires_at: string
          token: string
        }[]
      }
      hit_rate_limit: {
        Args: { p_action: string; p_max: number; p_window: string }
        Returns: undefined
      }
      http_failures: {
        Args: { p_since_hours?: number }
        Returns: {
          created: string
          error_msg: string
          id: number
          status_code: number
        }[]
      }
      inactive_anonymous_user_ids: {
        Args: { p_limit?: number }
        Returns: string[]
      }
      invite_key: { Args: never; Returns: string }
      is_inactive_anonymous_user: { Args: { p_id: string }; Returns: boolean }
      is_member: { Args: { p_board: string }; Returns: boolean }
      job_failures: {
        Args: { p_since_hours?: number }
        Returns: {
          jobname: string
          return_message: string
          start_time: string
          status: string
        }[]
      }
      keep_cycle: { Args: { p_id: string }; Returns: undefined }
      keep_longer: { Args: { p_id: string }; Returns: undefined }
      leave_board: { Args: { p_board_id: string }; Returns: undefined }
      list_blocked: {
        Args: { p_board_id: string }
        Returns: {
          blocked_at: string
          display_name: string
          user_id: string
        }[]
      }
      list_removed_items: {
        Args: { p_board_id: string }
        Returns: {
          board_id: string
          body: string | null
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string
          keep_until: string | null
          layout: Json | null
          paper_style: string | null
          photo_path: string | null
          pinned: boolean
          place: string | null
          shared_from_app: string | null
          shared_from_author: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_by: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_reported_items: {
        Args: { p_board_id: string }
        Returns: {
          author_name: string
          board_id: string
          body: string
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string
          event_at: string
          id: string
          keep_until: string
          photo_path: string
          pinned: boolean
          place: string
          reasons: string[]
          report_count: number
          title: string
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          version: number
        }[]
      }
      move_magnet: {
        Args: {
          p_expected_version?: number
          p_id: string
          p_item_id?: string
          p_x: number
          p_y: number
        }
        Returns: {
          art_id: string
          board_id: string
          created_at: string
          gift_note: string | null
          id: string
          item_id: string | null
          pack_id: string
          placed_by: string | null
          rotation: number
          updated_at: string
          version: number
          x: number
          y: number
          z: number
        }
        SetofOptions: {
          from: "*"
          to: "board_magnets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      normalise_invite_code: { Args: { p_raw: string }; Returns: string }
      photo_paths_in_use: {
        Args: never
        Returns: {
          paths: string[]
          total: number
        }[]
      }
      pick_invite_code: { Args: never; Returns: string }
      place_magnet: {
        Args: {
          p_art_id: string
          p_board_id: string
          p_gift_note?: string
          p_item_id?: string
          p_rotation?: number
          p_x: number
          p_y: number
        }
        Returns: {
          art_id: string
          board_id: string
          created_at: string
          gift_note: string | null
          id: string
          item_id: string | null
          pack_id: string
          placed_by: string | null
          rotation: number
          updated_at: string
          version: number
          x: number
          y: number
          z: number
        }
        SetofOptions: {
          from: "*"
          to: "board_magnets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_item: {
        Args: {
          p_board_id: string
          p_body: string
          p_color: Database["public"]["Enums"]["item_color"]
          p_entries?: Json
          p_event_at: string
          p_id: string
          p_photo_path: string
          p_pinned?: boolean
          p_place: string
          p_title: string
          p_type: Database["public"]["Enums"]["item_type"]
        }
        Returns: {
          board_id: string
          body: string | null
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string
          keep_until: string | null
          layout: Json | null
          paper_style: string | null
          photo_path: string | null
          pinned: boolean
          place: string | null
          shared_from_app: string | null
          shared_from_author: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_shared_item: {
        Args: {
          p_board_id: string
          p_body: string
          p_color: Database["public"]["Enums"]["item_color"]
          p_entries?: Json
          p_event_at: string
          p_id: string
          p_photo_path: string
          p_pinned?: boolean
          p_place: string
          p_shared_from_app?: string
          p_shared_from_author?: string
          p_title: string
          p_type: Database["public"]["Enums"]["item_type"]
        }
        Returns: {
          board_id: string
          body: string | null
          color: Database["public"]["Enums"]["item_color"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          event_at: string | null
          id: string
          keep_until: string | null
          layout: Json | null
          paper_style: string | null
          photo_path: string | null
          pinned: boolean
          place: string | null
          shared_from_app: string | null
          shared_from_author: string | null
          title: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      preview_invite: {
        Args: { p_token_or_code: string }
        Returns: {
          board_name: string
          invited_by: string
          member_count: number
          member_first_names: string[]
        }[]
      }
      preview_invite_token: {
        Args: { p_token: string }
        Returns: {
          board_name: string
          invited_by: string
          member_count: number
          member_first_names: string[]
        }[]
      }
      project_photo_bytes_used: { Args: never; Returns: number }
      promote_longest_member: {
        Args: { p_board_id: string }
        Returns: undefined
      }
      purge_boards: { Args: never; Returns: number }
      purge_items: { Args: { p_ids: string[] }; Returns: number }
      purge_stale_invites: { Args: never; Returns: number }
      purge_stale_upload_intents: { Args: never; Returns: number }
      remove_and_block: { Args: { p_item_id: string }; Returns: undefined }
      remove_entry: { Args: { p_id: string }; Returns: undefined }
      remove_item: { Args: { p_id: string }; Returns: undefined }
      remove_magnet: { Args: { p_id: string }; Returns: undefined }
      remove_member: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: undefined
      }
      rename_board: {
        Args: { p_board_id: string; p_color: string; p_name: string }
        Returns: undefined
      }
      report_post: {
        Args: { p_item_id: string; p_reason?: string }
        Returns: undefined
      }
      reset_invite_link: { Args: { p_board_id: string }; Returns: undefined }
      restore_item: { Args: { p_id: string }; Returns: undefined }
      run_edge_job: { Args: { p_path: string }; Returns: undefined }
      run_list_lifetime: { Args: { p_item_id: string }; Returns: undefined }
      set_board_theme: {
        Args: { p_board_id: string; p_pack_id: string }
        Returns: undefined
      }
      set_done: { Args: { p_done: boolean; p_id: string }; Returns: undefined }
      set_entry_checked: {
        Args: { p_checked: boolean; p_id: string }
        Returns: undefined
      }
      set_item_position: {
        Args: { p_id: string; p_x: number; p_y: number }
        Returns: undefined
      }
      set_pinned: {
        Args: { p_id: string; p_pinned: boolean }
        Returns: undefined
      }
      start_photo_upload: {
        Args: { p_board_id: string; p_item_id: string }
        Returns: string
      }
      unblock_member: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: undefined
      }
      update_profile: {
        Args: {
          p_avatar_path?: string
          p_clear_avatar?: boolean
          p_display_name: string
        }
        Returns: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      item_color:
        | "butter"
        | "blush"
        | "sage"
        | "sky"
        | "lavender"
        | "peach"
        | "paper"
      item_type: "note" | "list" | "date" | "photo"
      member_role: "owner" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      item_color: [
        "butter",
        "blush",
        "sage",
        "sky",
        "lavender",
        "peach",
        "paper",
      ],
      item_type: ["note", "list", "date", "photo"],
      member_role: ["owner", "member"],
    },
  },
} as const

