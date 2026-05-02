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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          campus_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          campus_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          campus_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "audit_logs_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          closing_time: string | null
          code: string
          commission_rate: number | null
          created_at: string
          id: string
          is_active: boolean
          is_open: boolean | null
          logo_url: string | null
          name: string
          opening_time: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          prep_time_minutes: number | null
          razorpay_account_id: string | null
          settings: Json
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          closing_time?: string | null
          code: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          logo_url?: string | null
          name: string
          opening_time?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          prep_time_minutes?: number | null
          razorpay_account_id?: string | null
          settings?: Json
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          closing_time?: string | null
          code?: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          logo_url?: string | null
          name?: string
          opening_time?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          prep_time_minutes?: number | null
          razorpay_account_id?: string | null
          settings?: Json
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          campus_id: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "categories_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          campus_id: string | null
          created_at: string
          id: string
          net_canteen_payout: number
          order_id: string
          platform_fee: number
          settlement_status: string
          total_order_value: number
          transaction_type: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          id?: string
          net_canteen_payout: number
          order_id: string
          platform_fee: number
          settlement_status?: string
          total_order_value: number
          transaction_type?: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          id?: string
          net_canteen_payout?: number
          order_id?: string
          platform_fee?: number
          settlement_status?: string
          total_order_value?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          campus_id: string
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          is_veg: boolean
          name: string
          price: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          campus_id: string
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          is_veg?: boolean
          name: string
          price: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          campus_id?: string
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          is_veg?: boolean
          name?: string
          price?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "menu_items_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
offers: {
        Row: {
          id: string
          promo_code: string
          discount_type: "flat" | "percentage" // 🦅 STRICT TYPE
          discount_value: number
          max_discount_amount: number | null
          min_order_value: number
          sponsored_by: "platform" | "canteen" // 🦅 STRICT TYPE
          current_uses: number
          max_global_uses: number | null
          max_uses_per_user: number | null
          valid_from: string | null
          valid_until: string | null
          is_active: boolean
          created_at: string
          campus_id: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block
          target_item_id: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block
        }
        Insert: {
          id?: string
          promo_code: string
          discount_type: "flat" | "percentage"
          discount_value: number
          max_discount_amount?: number | null
          min_order_value?: number
          sponsored_by?: "platform" | "canteen"
          current_uses?: number
          max_global_uses?: number | null
          max_uses_per_user?: number | null
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          created_at?: string
          campus_id?: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block
          target_item_id?: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block
        }
        Update: {
          id?: string
          promo_code?: string
          discount_type?: "flat" | "percentage"
          discount_value?: number
          max_discount_amount?: number | null
          min_order_value?: number
          sponsored_by?: "platform" | "canteen"
          current_uses?: number
          max_global_uses?: number | null
          max_uses_per_user?: number | null
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          created_at?: string
          campus_id?: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block '?'
          target_item_id?: string | null // 🦅 ADD THIS TO Row, Insert, AND Update in the offers block
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number | null
          campus_id: string
          collection_token: string | null
          commission_amount: number | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null // 🦅 ADDED HERE
          discount_sponsor: string | null // 🦅 ADDED HERE
          id: string
          is_used: boolean
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          platform_fee: number | null
          promo_code: string | null // 🦅 ADDED HERE
          qr_code: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"]
          ticket_code: string | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          discount_amount?: number | null // ✅ Added '?'
          discount_sponsor?: string | null // ✅ Added '?'
          amount?: number | null
          campus_id: string
          collection_token?: string | null
          commission_amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_used?: boolean
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          promo_code?: string | null // 🦅 ADDED HERE
          qr_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_code?: string | null
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
         discount_amount?: number | null // ✅ Added '?'
          discount_sponsor?: string | null // ✅ Added '?'
          amount?: number | null
          campus_id?: string
          collection_token?: string | null
          commission_amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_used?: boolean
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          promo_code?: string | null // 🦅 ADDED HERE
          qr_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_code?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "orders_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Relationships: []
      }
      platform_alerts: {
        Row: {
          campus_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          severity?: string
          title: string
          type: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_alerts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_alerts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "platform_alerts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          global_commission_rate: number | null
          id: string
          manual_verification_enabled: boolean | null
          orders_paused: boolean
          orders_paused_at: string | null
          orders_paused_reason: string | null
          settlement_period: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          global_commission_rate?: number | null
          id?: string
          manual_verification_enabled?: boolean | null
          orders_paused?: boolean
          orders_paused_at?: string | null
          orders_paused_reason?: string | null
          settlement_period?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          global_commission_rate?: number | null
          id?: string
          manual_verification_enabled?: boolean | null
          orders_paused?: boolean
          orders_paused_at?: string | null
          orders_paused_reason?: string | null
          settlement_period?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          campus_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          campus_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          campus_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_ledger: {
        Row: {
          amount: number
          campus_id: string
          created_at: string
          created_by: string
          customer_email: string | null
          customer_name: string | null
          id: string
          order_id: string
          order_number: string
          razorpay_payment_id: string | null
          reason: string
          refund_reference: string | null
          refund_status: string
          refunded_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          campus_id: string
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_id: string
          order_number: string
          razorpay_payment_id?: string | null
          reason: string
          refund_reference?: string | null
          refund_status?: string
          refunded_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          campus_id?: string
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string
          order_number?: string
          razorpay_payment_id?: string | null
          reason?: string
          refund_reference?: string | null
          refund_status?: string
          refunded_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          campus_id: string | null
          created_at: string | null
          id: string
          platform_fee: number
          razorpay_account_id: string
          settled_at: string | null
          status: string | null
          utr_number: string | null
        }
        Insert: {
          amount?: number
          campus_id?: string | null
          created_at?: string | null
          id?: string
          platform_fee?: number
          razorpay_account_id: string
          settled_at?: string | null
          status?: string | null
          utr_number?: string | null
        }
        Update: {
          amount?: number
          campus_id?: string | null
          created_at?: string | null
          id?: string
          platform_fee?: number
          razorpay_account_id?: string
          settled_at?: string | null
          status?: string | null
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlements_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "settlements_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "user_roles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campus_public_info: {
        Row: {
          address: string | null
          branding: Json | null
          code: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          public_operational_settings: Json | null
        }
        Insert: {
          address?: string | null
          branding?: never
          code?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          public_operational_settings?: never
        }
        Update: {
          address?: string | null
          branding?: never
          code?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          public_operational_settings?: never
        }
        Relationships: []
      }
      campus_settlement_summary: {
        Row: {
          campus_code: string | null
          campus_id: string | null
          campus_name: string | null
          pending_orders: number | null
          pending_payout: number | null
          total_paid_out: number | null
          total_platform_profit: number | null
        }
        Relationships: []
      }
      profiles_readable: {
        Row: {
          campus_code: string | null
          campus_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      settlement_history_log: {
        Row: {
          amount_paid: number | null
          campus_code: string | null
          campus_id: string | null
          campus_name: string | null
          order_date: string | null
          platform_profit: number | null
          total_gmv: number | null
          total_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "financial_ledger_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles_readable: {
        Row: {
          campus_code: string | null
          campus_id: string | null
          campus_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus_settlement_summary"
            referencedColumns: ["campus_id"]
          },
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      atomic_decrement_stock: { Args: { p_order_id: string }; Returns: Json }
      calculate_platform_fee: { Args: { cart_total: number }; Returns: number }
      check_phone_exists: { Args: { phone_input: string }; Returns: boolean }
      cleanup_expired_admin_sessions: { Args: never; Returns: number }
      cleanup_old_orders: { Args: never; Returns: number }
      cleanup_orders_older_than_48h: { Args: never; Returns: undefined }
      cleanup_stuck_pending_orders: { Args: never; Returns: number }
      decrement_stock: {
        Args: { p_item_id: string; p_quantity: number }
        Returns: undefined
      }
      expire_uncollected_orders_5h: { Args: never; Returns: undefined }
      fail_expired_orders_automatically: { Args: never; Returns: undefined }
      get_campus_health: { Args: never; Returns: Json }
      get_campus_user_stats: { Args: { p_campus_id?: string }; Returns: Json }
      get_filtered_settlements: {
        Args: {
          p_campus_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          campus_code: string
          campus_id: string
          campus_name: string
          pending_orders: number
          pending_payout: number
          settlement_date: string
          total_paid_out: number
          total_platform_profit: number
        }[]
      }
      get_ledger_stats:
        | { Args: { p_campus_id?: string }; Returns: Json }
        | {
            Args: {
              p_campus_id?: string
              p_end_date?: string
              p_start_date?: string
            }
            Returns: Json
          }
      get_super_admin_stats: { Args: { p_campus_id?: string }; Returns: Json }
      get_user_campus_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_at_campus: {
        Args: {
          _campus_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_campus_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_order_collected: { Args: { p_order_id: string }; Returns: Json }
      mark_order_collected_secure: {
        Args: { p_secret_token: string }
        Returns: Json
      }
      mark_settlement_paid: {
        Args: {
          p_campus_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: undefined
      }
place_order_atomic: {
          Args: {
            p_user_id: string
            p_campus_id: string
            p_customer_name: string
            p_customer_email: string
            p_customer_phone?: string | null
            p_promo_code?: string | null
            p_items: Json
          }
          Returns: Json
        }
      reset_item_stock: {
        Args: { item_id: string; new_stock?: number }
        Returns: undefined
      }
      restore_order_stock: { Args: { p_order_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "student" | "admin" | "kiosk" | "super_admin"
      day_of_week: "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
      // 🌟 UPDATED WITH YOUR NEW VALUES 🌟
      order_status: "pending" | "confirmed" | "collected" | "expired" | "failed" | "cancelled" | "rejected" | "refunded"
      time_period: "breakfast" | "lunch" | "snacks" | "dinner"
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
      app_role: ["student", "admin", "kiosk", "super_admin"],
      day_of_week: ["mon", "tue", "wed", "thu", "fri", "sat"],
      // 🌟 UPDATED THE CONSTANT ARRAY AS WELL 🌟
      order_status: ["pending", "confirmed", "collected", "expired", "failed", "cancelled", "rejected", "refunded"],
      time_period: ["breakfast", "lunch", "snacks", "dinner"],
    },
  },
} as const