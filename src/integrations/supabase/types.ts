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
      abuse_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          endpoint: string | null
          id: string
          ip_hash: string
          reason: string | null
        }
        Insert: {
          blocked_until: string
          created_at?: string
          endpoint?: string | null
          id?: string
          ip_hash: string
          reason?: string | null
        }
        Update: {
          blocked_until?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          ip_hash?: string
          reason?: string | null
        }
        Relationships: []
      }
      acquirer_failover_events: {
        Row: {
          created_at: string
          error_message: string | null
          from_acquirer_id: string | null
          id: string
          metadata: Json | null
          reason: string
          seller_id: string | null
          success: boolean
          to_acquirer_id: string | null
          transaction_id: string | null
          trigger_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          from_acquirer_id?: string | null
          id?: string
          metadata?: Json | null
          reason: string
          seller_id?: string | null
          success?: boolean
          to_acquirer_id?: string | null
          transaction_id?: string | null
          trigger_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          from_acquirer_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string
          seller_id?: string | null
          success?: boolean
          to_acquirer_id?: string | null
          transaction_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquirer_failover_events_from_acquirer_id_fkey"
            columns: ["from_acquirer_id"]
            isOneToOne: false
            referencedRelation: "acquirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquirer_failover_events_to_acquirer_id_fkey"
            columns: ["to_acquirer_id"]
            isOneToOne: false
            referencedRelation: "acquirers"
            referencedColumns: ["id"]
          },
        ]
      }
      acquirer_health_events: {
        Row: {
          acquirer_id: string
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          latency_ms: number | null
          message: string | null
          metadata: Json | null
          severity: string
        }
        Insert: {
          acquirer_id: string
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          severity?: string
        }
        Update: {
          acquirer_id?: string
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquirer_health_events_acquirer_id_fkey"
            columns: ["acquirer_id"]
            isOneToOne: false
            referencedRelation: "acquirers"
            referencedColumns: ["id"]
          },
        ]
      }
      acquirers: {
        Row: {
          allow_failover: boolean
          api_endpoint: string | null
          api_environment: string | null
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          avg_latency_ms: number | null
          conversion_rate: number
          created_at: string
          description: string | null
          has_api_key: boolean | null
          has_api_secret: boolean | null
          has_webhook_secret: boolean | null
          health_status: string
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_health_check_at: string | null
          last_latency_ms: number | null
          max_transaction_amount: number | null
          min_transaction_amount: number | null
          name: string
          notes: string | null
          priority: number
          seller_visible: boolean
          slug: string
          supported_methods: string[]
          transaction_fee_fixed: number | null
          transaction_fee_percentage: number | null
          type: string
          updated_at: string
          uptime_pct: number | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          allow_failover?: boolean
          api_endpoint?: string | null
          api_environment?: string | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          avg_latency_ms?: number | null
          conversion_rate?: number
          created_at?: string
          description?: string | null
          has_api_key?: boolean | null
          has_api_secret?: boolean | null
          has_webhook_secret?: boolean | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_health_check_at?: string | null
          last_latency_ms?: number | null
          max_transaction_amount?: number | null
          min_transaction_amount?: number | null
          name: string
          notes?: string | null
          priority?: number
          seller_visible?: boolean
          slug: string
          supported_methods?: string[]
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          type?: string
          updated_at?: string
          uptime_pct?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          allow_failover?: boolean
          api_endpoint?: string | null
          api_environment?: string | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          avg_latency_ms?: number | null
          conversion_rate?: number
          created_at?: string
          description?: string | null
          has_api_key?: boolean | null
          has_api_secret?: boolean | null
          has_webhook_secret?: boolean | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_health_check_at?: string | null
          last_latency_ms?: number | null
          max_transaction_amount?: number | null
          min_transaction_amount?: number | null
          name?: string
          notes?: string | null
          priority?: number
          seller_visible?: boolean
          slug?: string
          supported_methods?: string[]
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          type?: string
          updated_at?: string
          uptime_pct?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      admin_2fa_codes: {
        Row: {
          access_token: string | null
          attempts: number | null
          code_hash: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          refresh_token: string | null
          role: string | null
          temp_token: string | null
        }
        Insert: {
          access_token?: string | null
          attempts?: number | null
          code_hash: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          role?: string | null
          temp_token?: string | null
        }
        Update: {
          access_token?: string | null
          attempts?: number | null
          code_hash?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          role?: string | null
          temp_token?: string | null
        }
        Relationships: []
      }
      admin_alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          metadata: Json
          resolved_at: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          scope: string
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          scope?: string
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          scope?: string
          success?: boolean
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          affiliate_user_id: string
          clicks: number
          commission_pct: number
          created_at: string
          id: string
          is_active: boolean
          owner_user_id: string
          product_id: string
          slug: string
        }
        Insert: {
          affiliate_user_id: string
          clicks?: number
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          owner_user_id: string
          product_id: string
          slug: string
        }
        Update: {
          affiliate_user_id?: string
          clicks?: number
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          owner_user_id?: string
          product_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_sales: {
        Row: {
          affiliate_link_id: string
          affiliate_user_id: string
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          paid_at: string | null
          product_id: string
          sale_amount: number
          seller_user_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          affiliate_link_id: string
          affiliate_user_id: string
          commission_amount: number
          commission_pct: number
          created_at?: string
          id?: string
          paid_at?: string | null
          product_id: string
          sale_amount: number
          seller_user_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          affiliate_link_id?: string
          affiliate_user_id?: string
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          product_id?: string
          sale_amount?: number
          seller_user_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_sales_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_sales_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipations: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          idempotency_key: string
          max_days: number
          net_amount: number
          status: string
          transaction_ids: string[]
          tx_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          idempotency_key: string
          max_days: number
          net_amount?: number
          status?: string
          transaction_ids?: string[]
          tx_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          idempotency_key?: string
          max_days?: number
          net_amount?: number
          status?: string
          transaction_ids?: string[]
          tx_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_idempotency_keys: {
        Row: {
          api_key_id: string
          created_at: string
          expires_at: string
          id: string
          key: string
          request_hash: string
          response_body: Json
          response_status: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          request_hash: string
          response_body: Json
          response_status?: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          ip_allowlist: string[]
          is_active: boolean
          last_used_at: string | null
          name: string
          permissions: string[]
          public_key: string
          revoked_at: string | null
          secret_key_hash: string
          secret_key_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_allowlist?: string[]
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          public_key: string
          revoked_at?: string | null
          secret_key_hash: string
          secret_key_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_allowlist?: string[]
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          public_key?: string
          revoked_at?: string | null
          secret_key_hash?: string
          secret_key_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_code: string | null
          id: string
          ip: string | null
          latency_ms: number
          method: string
          request_id: string
          status_code: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_code?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method: string
          request_id: string
          status_code: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_code?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method?: string
          request_id?: string
          status_code?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_deliveries: {
        Row: {
          app_name: string
          attempt: number
          created_at: string
          delivered_at: string | null
          error: string | null
          event: string
          id: string
          integration_id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name: string
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event: string
          id?: string
          integration_id: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event?: string
          id?: string
          integration_id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_deliveries_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "app_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_deliveries_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "app_integrations_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_deliveries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_integrations: {
        Row: {
          api_key: string | null
          api_url: string | null
          app_name: string
          config: Json
          created_at: string
          events: Json
          id: string
          is_active: boolean
          product_id: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          app_name: string
          config?: Json
          created_at?: string
          events?: Json
          id?: string
          is_active?: boolean
          product_id?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          app_name?: string
          config?: Json
          created_at?: string
          events?: Json
          id?: string
          is_active?: boolean
          product_id?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_integrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_abuse_events: {
        Row: {
          created_at: string
          endpoint: string | null
          event_type: string
          id: string
          identifier_hash: string | null
          ip_hash: string | null
          metadata: Json
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          event_type: string
          id?: string
          identifier_hash?: string | null
          ip_hash?: string | null
          metadata?: Json
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          event_type?: string
          id?: string
          identifier_hash?: string | null
          ip_hash?: string | null
          metadata?: Json
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      balance_adjustments: {
        Row: {
          admin_user_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          admin_user_id: string
          amount: number
          created_at?: string
          id?: string
          reason: string
          type?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_number_enc: string | null
          account_number_masked: string | null
          account_type: string
          agency: string
          bank_code: string | null
          bank_name: string
          created_at: string
          holder_document: string | null
          holder_document_enc: string | null
          holder_document_masked: string | null
          holder_name: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_number_enc?: string | null
          account_number_masked?: string | null
          account_type?: string
          agency: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          holder_document?: string | null
          holder_document_enc?: string | null
          holder_document_masked?: string | null
          holder_name: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_number_enc?: string | null
          account_number_masked?: string | null
          account_type?: string
          agency?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          holder_document?: string | null
          holder_document_enc?: string | null
          holder_document_masked?: string | null
          holder_name?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          code: string
          course_id: string
          course_title: string
          id: string
          issued_at: string
          student_name: string
          total_lessons: number
          user_id: string
        }
        Insert: {
          code: string
          course_id: string
          course_title?: string
          id?: string
          issued_at?: string
          student_name?: string
          total_lessons?: number
          user_id: string
        }
        Update: {
          code?: string
          course_id?: string
          course_title?: string
          id?: string
          issued_at?: string
          student_name?: string
          total_lessons?: number
          user_id?: string
        }
        Relationships: []
      }
      co_productions: {
        Row: {
          accepted_at: string | null
          co_producer_email: string
          co_producer_user_id: string | null
          created_at: string
          id: string
          owner_user_id: string
          product_id: string
          split_percentage: number
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          co_producer_email: string
          co_producer_user_id?: string | null
          created_at?: string
          id?: string
          owner_user_id: string
          product_id: string
          split_percentage?: number
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          co_producer_email?: string
          co_producer_user_id?: string | null
          created_at?: string
          id?: string
          owner_user_id?: string
          product_id?: string
          split_percentage?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_productions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_productions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          apply_to_bumps: boolean
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          product_id: string | null
          total_discount_amount: number
          user_id: string
        }
        Insert: {
          apply_to_bumps?: boolean
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          product_id?: string | null
          total_discount_amount?: number
          user_id: string
        }
        Update: {
          apply_to_bumps?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          product_id?: string | null
          total_discount_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean | null
          product_id: string | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean | null
          product_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean | null
          product_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_user_fees: {
        Row: {
          admin_user_id: string
          boleto_fixed: number | null
          boleto_percentage: number | null
          card_fixed: number | null
          card_percentage: number | null
          created_at: string
          id: string
          max_ticket: number | null
          pix_fixed: number | null
          pix_percentage: number | null
          transaction_fixed: number | null
          transaction_percentage: number | null
          updated_at: string
          user_id: string
          withdrawal_fee: number | null
        }
        Insert: {
          admin_user_id: string
          boleto_fixed?: number | null
          boleto_percentage?: number | null
          card_fixed?: number | null
          card_percentage?: number | null
          created_at?: string
          id?: string
          max_ticket?: number | null
          pix_fixed?: number | null
          pix_percentage?: number | null
          transaction_fixed?: number | null
          transaction_percentage?: number | null
          updated_at?: string
          user_id: string
          withdrawal_fee?: number | null
        }
        Update: {
          admin_user_id?: string
          boleto_fixed?: number | null
          boleto_percentage?: number | null
          card_fixed?: number | null
          card_percentage?: number | null
          created_at?: string
          id?: string
          max_ticket?: number | null
          pix_fixed?: number | null
          pix_percentage?: number | null
          transaction_fixed?: number | null
          transaction_percentage?: number | null
          updated_at?: string
          user_id?: string
          withdrawal_fee?: number | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          admin_user_id: string | null
          amount: number
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          created_at: string
          evidence_urls: Json
          id: string
          reason: string | null
          resolved_at: string | null
          seller_user_id: string
          status: string
          transaction_id: string | null
          type: string
          updated_at: string
          won_by_seller: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          admin_user_id?: string | null
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string
          evidence_urls?: Json
          id?: string
          reason?: string | null
          resolved_at?: string | null
          seller_user_id: string
          status?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          won_by_seller?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          admin_user_id?: string | null
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string
          evidence_urls?: Json
          id?: string
          reason?: string | null
          resolved_at?: string | null
          seller_user_id?: string
          status?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          won_by_seller?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_type: string
          id: string
          message: string
          metadata: Json | null
          resolved: boolean
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_type?: string
          id?: string
          message: string
          metadata?: Json | null
          resolved?: boolean
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          resolved?: boolean
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      fees: {
        Row: {
          created_at: string
          description: string | null
          fee_type: string
          id: string
          name: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          name: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          name?: string
          value?: number
        }
        Relationships: []
      }
      financial_ledger: {
        Row: {
          adjustment_id: string | null
          amount: number
          balance_after: number
          created_at: string
          description: string
          entry_type: string
          id: string
          idempotency_key: string | null
          transaction_id: string | null
          user_id: string
          withdrawal_id: string | null
        }
        Insert: {
          adjustment_id?: string | null
          amount: number
          balance_after: number
          created_at?: string
          description?: string
          entry_type: string
          id?: string
          idempotency_key?: string | null
          transaction_id?: string | null
          user_id: string
          withdrawal_id?: string | null
        }
        Update: {
          adjustment_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          entry_type?: string
          id?: string
          idempotency_key?: string | null
          transaction_id?: string | null
          user_id?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "balance_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_logs: {
        Row: {
          block_reason: string
          block_type: string
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_ip: string | null
          id: string
          matched_type: string | null
          matched_value: string | null
          metadata: Json | null
          product_id: string | null
          seller_user_id: string | null
        }
        Insert: {
          block_reason: string
          block_type: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_ip?: string | null
          id?: string
          matched_type?: string | null
          matched_value?: string | null
          metadata?: Json | null
          product_id?: string | null
          seller_user_id?: string | null
        }
        Update: {
          block_reason?: string
          block_type?: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_ip?: string | null
          id?: string
          matched_type?: string | null
          matched_value?: string | null
          metadata?: Json | null
          product_id?: string | null
          seller_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      global_blacklist: {
        Row: {
          added_by: string
          created_at: string
          entry_type: string
          entry_value: string
          id: string
          is_active: boolean
          reason: string
          updated_at: string
        }
        Insert: {
          added_by: string
          created_at?: string
          entry_type: string
          entry_value: string
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Update: {
          added_by?: string
          created_at?: string
          entry_type?: string
          entry_value?: string
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          key: string
          response: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          response?: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          response?: Json
        }
        Relationships: []
      }
      ip_logs: {
        Row: {
          country: string | null
          created_at: string
          id: string
          ip: string
          source: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          ip: string
          source?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          ip?: string
          source?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lesson_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          timestamp_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          drip_days: number | null
          duration_minutes: number | null
          id: string
          is_free: boolean | null
          module_id: string
          sort_order: number | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          drip_days?: number | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          module_id: string
          sort_order?: number | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          drip_days?: number | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          module_id?: string
          sort_order?: number | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_fee_limits: {
        Row: {
          created_at: string
          id: string
          min_transaction_fixed: number
          min_transaction_percentage: number
          min_withdrawal_fee: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          min_transaction_fixed?: number
          min_transaction_percentage?: number
          min_withdrawal_fee?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          min_transaction_fixed?: number
          min_transaction_percentage?: number
          min_withdrawal_fee?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      manager_seller_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          manager_user_id: string
          notes: string | null
          seller_user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          manager_user_id: string
          notes?: string | null
          seller_user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          manager_user_id?: string
          notes?: string | null
          seller_user_id?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          banner_url: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          banner_url?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number | null
          title: string
        }
        Update: {
          banner_url?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_bumps: {
        Row: {
          bump_product_id: string
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          sort_order: number | null
        }
        Insert: {
          bump_product_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          sort_order?: number | null
        }
        Update: {
          bump_product_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_keys: {
        Row: {
          created_at: string
          id: string
          key_type: string
          key_value: string | null
          key_value_enc: string | null
          key_value_masked: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_type: string
          key_value?: string | null
          key_value_enc?: string | null
          key_value_masked?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_type?: string
          key_value?: string | null
          key_value_enc?: string | null
          key_value_masked?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      podpay_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          headers: Json | null
          id: string
          podpay_payment_id: string | null
          processing_result: string
          raw_payload: Json
          signature: string | null
          signature_valid: boolean
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          headers?: Json | null
          id?: string
          podpay_payment_id?: string | null
          processing_result?: string
          raw_payload: Json
          signature?: string | null
          signature_valid?: boolean
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          headers?: Json | null
          id?: string
          podpay_payment_id?: string | null
          processing_result?: string
          raw_payload?: Json
          signature?: string | null
          signature_valid?: boolean
          transaction_id?: string | null
        }
        Relationships: []
      }
      product_pixels: {
        Row: {
          api_token: string | null
          boleto_conversion_value: number
          created_at: string
          disable_bump_events: boolean
          domain: string | null
          events: Json
          fire_on_boleto: boolean
          fire_on_pix_qr: boolean
          id: string
          is_active: boolean
          pix_conversion_value: number
          pixel_id: string
          platform: string
          product_id: string
          user_id: string
        }
        Insert: {
          api_token?: string | null
          boleto_conversion_value?: number
          created_at?: string
          disable_bump_events?: boolean
          domain?: string | null
          events?: Json
          fire_on_boleto?: boolean
          fire_on_pix_qr?: boolean
          id?: string
          is_active?: boolean
          pix_conversion_value?: number
          pixel_id: string
          platform: string
          product_id: string
          user_id: string
        }
        Update: {
          api_token?: string | null
          boleto_conversion_value?: number
          created_at?: string
          disable_bump_events?: boolean
          domain?: string | null
          events?: Json
          fire_on_boleto?: boolean
          fire_on_pix_qr?: boolean
          id?: string
          is_active?: boolean
          pix_conversion_value?: number
          pixel_id?: string
          platform?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_commission: number
          affiliate_enabled: boolean
          checkout_address_required: boolean | null
          checkout_banner_desktop_url: string | null
          checkout_banner_mobile_url: string | null
          checkout_boleto_enabled: boolean | null
          checkout_button_color: string | null
          checkout_credit_card_enabled: boolean | null
          checkout_email_confirm: boolean | null
          checkout_guarantee_enabled: boolean | null
          checkout_pix_enabled: boolean | null
          checkout_social_proof: boolean | null
          checkout_theme: string
          checkout_timer_enabled: boolean | null
          checkout_timer_minutes: number | null
          checkout_url: string | null
          classification: string
          co_producer_email: string | null
          co_production_enabled: boolean
          co_production_split: number
          created_at: string
          deleted_at: string | null
          delivery_type: string
          description: string | null
          display_name: string | null
          downsell_delay: number | null
          downsell_enabled: boolean
          downsell_price: number | null
          downsell_url: string | null
          email_timing: string
          id: string
          image_url: string | null
          name: string
          page_url: string | null
          price: number
          rejection_reason: string | null
          status: string
          support_email: string | null
          support_phone: string | null
          updated_at: string
          upsell_discount: number | null
          upsell_enabled: boolean
          upsell_name: string | null
          upsell_price: number | null
          upsell_type: string
          upsell_url: string | null
          user_id: string
        }
        Insert: {
          affiliate_commission?: number
          affiliate_enabled?: boolean
          checkout_address_required?: boolean | null
          checkout_banner_desktop_url?: string | null
          checkout_banner_mobile_url?: string | null
          checkout_boleto_enabled?: boolean | null
          checkout_button_color?: string | null
          checkout_credit_card_enabled?: boolean | null
          checkout_email_confirm?: boolean | null
          checkout_guarantee_enabled?: boolean | null
          checkout_pix_enabled?: boolean | null
          checkout_social_proof?: boolean | null
          checkout_theme?: string
          checkout_timer_enabled?: boolean | null
          checkout_timer_minutes?: number | null
          checkout_url?: string | null
          classification?: string
          co_producer_email?: string | null
          co_production_enabled?: boolean
          co_production_split?: number
          created_at?: string
          deleted_at?: string | null
          delivery_type?: string
          description?: string | null
          display_name?: string | null
          downsell_delay?: number | null
          downsell_enabled?: boolean
          downsell_price?: number | null
          downsell_url?: string | null
          email_timing?: string
          id?: string
          image_url?: string | null
          name: string
          page_url?: string | null
          price?: number
          rejection_reason?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          upsell_discount?: number | null
          upsell_enabled?: boolean
          upsell_name?: string | null
          upsell_price?: number | null
          upsell_type?: string
          upsell_url?: string | null
          user_id: string
        }
        Update: {
          affiliate_commission?: number
          affiliate_enabled?: boolean
          checkout_address_required?: boolean | null
          checkout_banner_desktop_url?: string | null
          checkout_banner_mobile_url?: string | null
          checkout_boleto_enabled?: boolean | null
          checkout_button_color?: string | null
          checkout_credit_card_enabled?: boolean | null
          checkout_email_confirm?: boolean | null
          checkout_guarantee_enabled?: boolean | null
          checkout_pix_enabled?: boolean | null
          checkout_social_proof?: boolean | null
          checkout_theme?: string
          checkout_timer_enabled?: boolean | null
          checkout_timer_minutes?: number | null
          checkout_url?: string | null
          classification?: string
          co_producer_email?: string | null
          co_production_enabled?: boolean
          co_production_split?: number
          created_at?: string
          deleted_at?: string | null
          delivery_type?: string
          description?: string | null
          display_name?: string | null
          downsell_delay?: number | null
          downsell_enabled?: boolean
          downsell_price?: number | null
          downsell_url?: string | null
          email_timing?: string
          id?: string
          image_url?: string | null
          name?: string
          page_url?: string | null
          price?: number
          rejection_reason?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          upsell_discount?: number | null
          upsell_enabled?: boolean
          upsell_name?: string | null
          upsell_price?: number | null
          upsell_type?: string
          upsell_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          acquirer_id: string | null
          address_locked: boolean | null
          admin_notes: string | null
          approved_by: string | null
          avatar_url: string | null
          balance_frozen: boolean
          boleto_enabled: boolean
          city: string | null
          complement: string | null
          created_at: string
          created_by_admin: string | null
          credit_card_enabled: boolean
          document_number: string | null
          document_type: string | null
          email: string | null
          frozen: boolean
          full_name: string | null
          id: string
          kyc_rejection_reason: string | null
          last_ip: string | null
          last_login_at: string | null
          neighborhood: string | null
          nickname: string | null
          phone: string | null
          pix_key: string | null
          pix_key_enc: string | null
          pix_key_masked: string | null
          pix_key_type: string | null
          seller_type: string | null
          staff_role_type: string | null
          state: string | null
          street: string | null
          street_number: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          account_status?: string
          acquirer_id?: string | null
          address_locked?: boolean | null
          admin_notes?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          balance_frozen?: boolean
          boleto_enabled?: boolean
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by_admin?: string | null
          credit_card_enabled?: boolean
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          frozen?: boolean
          full_name?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          neighborhood?: string | null
          nickname?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_enc?: string | null
          pix_key_masked?: string | null
          pix_key_type?: string | null
          seller_type?: string | null
          staff_role_type?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          account_status?: string
          acquirer_id?: string | null
          address_locked?: boolean | null
          admin_notes?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          balance_frozen?: boolean
          boleto_enabled?: boolean
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by_admin?: string | null
          credit_card_enabled?: boolean
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          frozen?: boolean
          full_name?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          neighborhood?: string | null
          nickname?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_enc?: string | null
          pix_key_masked?: string | null
          pix_key_type?: string | null
          seller_type?: string | null
          staff_role_type?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_acquirer_id_fkey"
            columns: ["acquirer_id"]
            isOneToOne: false
            referencedRelation: "acquirers"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id: string
          score: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          explanation: string | null
          id: string
          options: Json
          question: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_index: number
          created_at?: string
          explanation?: string | null
          id?: string
          options: Json
          question: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lesson_id: string
          max_attempts: number | null
          passing_score: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lesson_id: string
          max_attempts?: number | null
          passing_score?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lesson_id?: string
          max_attempts?: number | null
          passing_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          referred_email: string
          referred_user_id: string | null
          referrer_user_id: string
          reward_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_email: string
          referred_user_id?: string | null
          referrer_user_id: string
          reward_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_email?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      retention_settings: {
        Row: {
          card_release_days: number
          card_retention_pct: number
          created_at: string
          id: string
          pix_retention_pct: number
          retention_days: number
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          card_release_days?: number
          card_retention_pct?: number
          created_at?: string
          id?: string
          pix_retention_pct?: number
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          card_release_days?: number
          card_retention_pct?: number
          created_at?: string
          id?: string
          pix_retention_pct?: number
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          admin_notes: string | null
          created_at: string
          delivered_at: string | null
          document: string | null
          id: string
          phone: string
          recipient_name: string
          shipping_city: string
          shipping_complement: string | null
          shipping_neighborhood: string
          shipping_number: string
          shipping_state: string
          shipping_street: string
          shipping_zip: string
          status: string
          tier_id: string
          tier_label: string
          tier_value: number
          tracking_carrier: string | null
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          document?: string | null
          id?: string
          phone: string
          recipient_name: string
          shipping_city: string
          shipping_complement?: string | null
          shipping_neighborhood: string
          shipping_number: string
          shipping_state: string
          shipping_street: string
          shipping_zip: string
          status?: string
          tier_id: string
          tier_label: string
          tier_value: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          document?: string | null
          id?: string
          phone?: string
          recipient_name?: string
          shipping_city?: string
          shipping_complement?: string | null
          shipping_neighborhood?: string
          shipping_number?: string
          shipping_state?: string
          shipping_street?: string
          shipping_zip?: string
          status?: string
          tier_id?: string
          tier_label?: string
          tier_value?: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          actor_role: string | null
          created_at: string
          endpoint: string | null
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          status_code: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_role?: string | null
          created_at?: string
          endpoint?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_role?: string | null
          created_at?: string
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seller_acquirer_config: {
        Row: {
          acquirer_id: string
          admin_user_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acquirer_id: string
          admin_user_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          acquirer_id?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_acquirer_config_acquirer_id_fkey"
            columns: ["acquirer_id"]
            isOneToOne: false
            referencedRelation: "acquirers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_auto_withdraw: {
        Row: {
          admin_user_id: string
          created_at: string
          enabled: boolean
          id: string
          max_amount: number
          pix_key_id: string | null
          target_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_amount?: number
          pix_key_id?: string | null
          target_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_amount?: number
          pix_key_id?: string | null
          target_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_auto_withdraw_pix_key_id_fkey"
            columns: ["pix_key_id"]
            isOneToOne: false
            referencedRelation: "pix_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_notes: {
        Row: {
          author_role: string
          author_user_id: string
          content: string
          created_at: string
          id: string
          seller_user_id: string
        }
        Insert: {
          author_role?: string
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          seller_user_id: string
        }
        Update: {
          author_role?: string
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          seller_user_id?: string
        }
        Relationships: []
      }
      staff_audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          staff_user_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          staff_user_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          staff_user_id?: string
        }
        Relationships: []
      }
      staff_commission_config: {
        Row: {
          base: string
          base_pct: number
          created_at: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          base?: string
          base_pct?: number
          created_at?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          base?: string
          base_pct?: number
          created_at?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_commission_overrides: {
        Row: {
          created_at: string
          id: string
          pct: number
          seller_user_id: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pct: number
          seller_user_id: string
          staff_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pct?: number
          seller_user_id?: string
          staff_user_id?: string
        }
        Relationships: []
      }
      staff_commission_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          staff_user_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          staff_user_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          staff_user_id?: string
          status?: string
        }
        Relationships: []
      }
      staff_commissions_ledger: {
        Row: {
          amount: number
          balance_after: number
          base_amount: number
          created_at: string
          description: string | null
          dispute_id: string | null
          id: string
          idempotency_key: string | null
          pct: number
          seller_user_id: string | null
          staff_user_id: string
          transaction_id: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          base_amount?: number
          created_at?: string
          description?: string | null
          dispute_id?: string | null
          id?: string
          idempotency_key?: string | null
          pct?: number
          seller_user_id?: string | null
          staff_user_id: string
          transaction_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          base_amount?: number
          created_at?: string
          description?: string | null
          dispute_id?: string | null
          id?: string
          idempotency_key?: string | null
          pct?: number
          seller_user_id?: string | null
          staff_user_id?: string
          transaction_id?: string | null
          type?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          interval: string
          interval_count: number
          is_active: boolean
          name: string
          price: number
          product_id: string | null
          trial_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          name: string
          price?: number
          product_id?: string | null
          trial_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          name?: string
          price?: number
          product_id?: string | null
          trial_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          plan_id: string
          seller_user_id: string
          status: string
          subscriber_email: string
          subscriber_name: string | null
          subscriber_user_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id: string
          seller_user_id: string
          status?: string
          subscriber_email: string
          subscriber_name?: string | null
          subscriber_user_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id?: string
          seller_user_id?: string
          status?: string
          subscriber_email?: string
          subscriber_name?: string | null
          subscriber_user_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          admin_user_id: string | null
          created_at: string
          id: string
          message: string
          priority: string
          replied_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          admin_user_id?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          replied_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          admin_user_id?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          replied_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          affiliate_link_id: string | null
          amount: number
          api_key_id: string | null
          checkout_session_id: string | null
          coupon_id: string | null
          created_at: string
          customer_address: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          external_id: string | null
          fee_amount: number
          id: string
          is_simulated: boolean
          metadata: Json
          net_amount: number
          payment_method: string | null
          pix_copy_paste: string | null
          pix_expires_at: string | null
          pix_qrcode: string | null
          podpay_event_id: string | null
          podpay_payment_id: string | null
          product_id: string | null
          refunded_amount: number
          retained_amount: number
          retained_until: string | null
          retention_released: boolean
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_link_id?: string | null
          amount: number
          api_key_id?: string | null
          checkout_session_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          external_id?: string | null
          fee_amount?: number
          id?: string
          is_simulated?: boolean
          metadata?: Json
          net_amount?: number
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qrcode?: string | null
          podpay_event_id?: string | null
          podpay_payment_id?: string | null
          product_id?: string | null
          refunded_amount?: number
          retained_amount?: number
          retained_until?: string | null
          retention_released?: boolean
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_link_id?: string | null
          amount?: number
          api_key_id?: string | null
          checkout_session_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          external_id?: string | null
          fee_amount?: number
          id?: string
          is_simulated?: boolean
          metadata?: Json
          net_amount?: number
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qrcode?: string | null
          podpay_event_id?: string | null
          podpay_payment_id?: string | null
          product_id?: string | null
          refunded_amount?: number
          retained_amount?: number
          retained_until?: string | null
          retention_released?: boolean
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access: {
        Row: {
          course_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          lesson_id: string
          progress_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id: string
          progress_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id?: string
          progress_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      velocity_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          is_enabled: boolean
          max_attempts: number
          rule_name: string
          rule_type: string
          threshold_amount: number | null
          time_window_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_attempts?: number
          rule_name: string
          rule_type: string
          threshold_amount?: number | null
          time_window_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_attempts?: number
          rule_name?: string
          rule_type?: string
          threshold_amount?: number | null
          time_window_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          secret?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          error: string | null
          event: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
          webhook_config_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          webhook_config_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          webhook_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          acquirer_response: Json | null
          amount: number
          bank_account_id: string | null
          created_at: string
          crypto_address: string | null
          crypto_currency: string | null
          crypto_network: string | null
          failure_code: string | null
          fee_amount: number
          id: string
          last_attempt_at: string | null
          net_amount: number
          origin: string
          payment_proof_url: string | null
          pix_key_id: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
          withdrawal_type: string
        }
        Insert: {
          acquirer_response?: Json | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          crypto_address?: string | null
          crypto_currency?: string | null
          crypto_network?: string | null
          failure_code?: string | null
          fee_amount?: number
          id?: string
          last_attempt_at?: string | null
          net_amount?: number
          origin?: string
          payment_proof_url?: string | null
          pix_key_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
          withdrawal_type?: string
        }
        Update: {
          acquirer_response?: Json | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          crypto_address?: string | null
          crypto_currency?: string | null
          crypto_network?: string | null
          failure_code?: string | null
          fee_amount?: number
          id?: string
          last_attempt_at?: string | null
          net_amount?: number
          origin?: string
          payment_proof_url?: string | null
          pix_key_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          withdrawal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_pix_key_id_fkey"
            columns: ["pix_key_id"]
            isOneToOne: false
            referencedRelation: "pix_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      affiliate_links_public: {
        Row: {
          product_id: string | null
          slug: string | null
        }
        Insert: {
          product_id?: string | null
          slug?: string | null
        }
        Update: {
          product_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      app_integrations_safe: {
        Row: {
          api_key_masked: string | null
          api_url: string | null
          app_name: string | null
          config: Json | null
          created_at: string | null
          events: Json | null
          has_api_key: boolean | null
          id: string | null
          is_active: boolean | null
          product_id: string | null
          updated_at: string | null
          user_id: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_masked?: never
          api_url?: string | null
          app_name?: string | null
          config?: Json | null
          created_at?: string | null
          events?: Json | null
          has_api_key?: never
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_masked?: never
          api_url?: string | null
          app_name?: string | null
          config?: Json | null
          created_at?: string | null
          events?: Json | null
          has_api_key?: never
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_integrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes_seller: {
        Row: {
          amount: number | null
          buyer_email_masked: string | null
          buyer_name_masked: string | null
          buyer_phone_masked: string | null
          created_at: string | null
          id: string | null
          reason: string | null
          resolved_at: string | null
          seller_user_id: string | null
          status: string | null
          transaction_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          buyer_email_masked?: never
          buyer_name_masked?: never
          buyer_phone_masked?: never
          created_at?: string | null
          id?: string | null
          reason?: string | null
          resolved_at?: string | null
          seller_user_id?: string | null
          status?: string | null
          transaction_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          buyer_email_masked?: never
          buyer_name_masked?: never
          buyer_phone_masked?: never
          created_at?: string | null
          id?: string | null
          reason?: string | null
          resolved_at?: string | null
          seller_user_id?: string | null
          status?: string | null
          transaction_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pixels_public: {
        Row: {
          boleto_conversion_value: number | null
          disable_bump_events: boolean | null
          domain: string | null
          events: Json | null
          fire_on_boleto: boolean | null
          fire_on_pix_qr: boolean | null
          id: string | null
          is_active: boolean | null
          pix_conversion_value: number | null
          pixel_id: string | null
          platform: string | null
          product_id: string | null
        }
        Insert: {
          boleto_conversion_value?: number | null
          disable_bump_events?: boolean | null
          domain?: string | null
          events?: Json | null
          fire_on_boleto?: boolean | null
          fire_on_pix_qr?: boolean | null
          id?: string | null
          is_active?: boolean | null
          pix_conversion_value?: number | null
          pixel_id?: string | null
          platform?: string | null
          product_id?: string | null
        }
        Update: {
          boleto_conversion_value?: number | null
          disable_bump_events?: boolean | null
          domain?: string | null
          events?: Json | null
          fire_on_boleto?: boolean | null
          fire_on_pix_qr?: boolean | null
          id?: string | null
          is_active?: boolean | null
          pix_conversion_value?: number | null
          pixel_id?: string | null
          platform?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products_public: {
        Row: {
          affiliate_commission: number | null
          affiliate_enabled: boolean | null
          checkout_address_required: boolean | null
          checkout_banner_desktop_url: string | null
          checkout_banner_mobile_url: string | null
          checkout_boleto_enabled: boolean | null
          checkout_button_color: string | null
          checkout_credit_card_enabled: boolean | null
          checkout_email_confirm: boolean | null
          checkout_guarantee_enabled: boolean | null
          checkout_pix_enabled: boolean | null
          checkout_social_proof: boolean | null
          checkout_theme: string | null
          checkout_timer_enabled: boolean | null
          checkout_timer_minutes: number | null
          checkout_url: string | null
          created_at: string | null
          delivery_type: string | null
          description: string | null
          display_name: string | null
          id: string | null
          image_url: string | null
          name: string | null
          price: number | null
          status: string | null
          support_email: string | null
        }
        Insert: {
          affiliate_commission?: number | null
          affiliate_enabled?: boolean | null
          checkout_address_required?: boolean | null
          checkout_banner_desktop_url?: string | null
          checkout_banner_mobile_url?: string | null
          checkout_boleto_enabled?: boolean | null
          checkout_button_color?: string | null
          checkout_credit_card_enabled?: boolean | null
          checkout_email_confirm?: boolean | null
          checkout_guarantee_enabled?: boolean | null
          checkout_pix_enabled?: boolean | null
          checkout_social_proof?: boolean | null
          checkout_theme?: string | null
          checkout_timer_enabled?: boolean | null
          checkout_timer_minutes?: number | null
          checkout_url?: string | null
          created_at?: string | null
          delivery_type?: string | null
          description?: string | null
          display_name?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          status?: string | null
          support_email?: string | null
        }
        Update: {
          affiliate_commission?: number | null
          affiliate_enabled?: boolean | null
          checkout_address_required?: boolean | null
          checkout_banner_desktop_url?: string | null
          checkout_banner_mobile_url?: string | null
          checkout_boleto_enabled?: boolean | null
          checkout_button_color?: string | null
          checkout_credit_card_enabled?: boolean | null
          checkout_email_confirm?: boolean | null
          checkout_guarantee_enabled?: boolean | null
          checkout_pix_enabled?: boolean | null
          checkout_social_proof?: boolean | null
          checkout_theme?: string | null
          checkout_timer_enabled?: boolean | null
          checkout_timer_minutes?: number | null
          checkout_url?: string | null
          created_at?: string | null
          delivery_type?: string | null
          description?: string | null
          display_name?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          status?: string | null
          support_email?: string | null
        }
        Relationships: []
      }
      quiz_questions_safe: {
        Row: {
          explanation: string | null
          id: string | null
          options: Json | null
          question: string | null
          quiz_id: string | null
          sort_order: number | null
        }
        Insert: {
          explanation?: string | null
          id?: string | null
          options?: Json | null
          question?: string | null
          quiz_id?: string | null
          sort_order?: number | null
        }
        Update: {
          explanation?: string | null
          id?: string | null
          options?: Json | null
          question?: string | null
          quiz_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs_safe: {
        Row: {
          created_at: string | null
          events: string[] | null
          id: string | null
          is_active: boolean | null
          secret_masked: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          events?: string[] | null
          id?: string | null
          is_active?: boolean | null
          secret_masked?: never
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          events?: string[] | null
          id?: string | null
          is_active?: boolean | null
          secret_masked?: never
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_kyc: { Args: { _user_id: string }; Returns: undefined }
      admin_broadcast_notification: {
        Args: {
          _message: string
          _target?: string
          _title: string
          _type?: string
        }
        Returns: number
      }
      admin_bulk_assign_acquirer: {
        Args: {
          _new_acquirer_id: string
          _reason?: string
          _seller_ids: string[]
        }
        Returns: {
          error: string
          seller_id: string
          success: boolean
        }[]
      }
      admin_decrypt_field: { Args: { _cipher: string }; Returns: string }
      admin_freeze_account: {
        Args: { _freeze: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_get_seller_balances: {
        Args: never
        Returns: {
          balance: number
          user_id: string
        }[]
      }
      admin_purge_orphan_notifications: { Args: never; Returns: number }
      admin_reject_kyc: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_reveal_bank_accounts: {
        Args: { _user_id: string }
        Returns: {
          account_number: string
          account_type: string
          agency: string
          bank_code: string
          bank_name: string
          created_at: string
          holder_document: string
          holder_name: string
          id: string
          is_default: boolean
        }[]
      }
      admin_reveal_pix_keys: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          is_default: boolean
          key_type: string
          key_value: string
        }[]
      }
      admin_reveal_profile: {
        Args: { _user_id: string }
        Returns: {
          document_number: string
          pix_key: string
          pix_key_type: string
          user_id: string
        }[]
      }
      apply_transaction_splits: { Args: { _tx_id: string }; Returns: undefined }
      backfill_financial_ledger_for_completed_tx: {
        Args: { _limit?: number }
        Returns: {
          credited: number
          feed: number
          processed: number
        }[]
      }
      bump_rate_limit: {
        Args: {
          _bucket_key: string
          _max_count: number
          _window_seconds: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      check_and_block_abuse: {
        Args: {
          _block_minutes?: number
          _endpoint: string
          _ip_hash: string
          _max_events?: number
          _window_seconds?: number
        }
        Returns: {
          blocked: boolean
          blocked_until: string
          count_in_window: number
        }[]
      }
      check_auto_withdrawal: { Args: { p_user_id: string }; Returns: undefined }
      check_blacklist: {
        Args: { _document?: string; _email?: string; _ip?: string }
        Returns: {
          block_reason: string
          blocked: boolean
          matched_type: string
          matched_value: string
        }[]
      }
      check_db_connections: { Args: never; Returns: number }
      check_error_rate: { Args: never; Returns: number }
      check_failed_crons: { Args: never; Returns: number }
      check_signup_conflicts: {
        Args: { _document_number: string; _email: string; _phone: string }
        Returns: string
      }
      check_velocity: {
        Args: { _email?: string; _ip?: string; _rule_type?: string }
        Returns: {
          attempt_count: number
          block_reason: string
          blocked: boolean
        }[]
      }
      claim_app_deliveries: {
        Args: { _limit?: number }
        Returns: {
          app_name: string
          attempt: number
          event: string
          id: string
          integration_id: string
          payload: Json
          transaction_id: string
          user_id: string
        }[]
      }
      claim_webhook_deliveries: {
        Args: { _limit?: number }
        Returns: {
          attempt: number
          event: string
          id: string
          payload: Json
          transaction_id: string
          user_id: string
          webhook_config_id: string
        }[]
      }
      current_user_email: { Args: never; Returns: string }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      decrypt_field: { Args: { _cipher: string }; Returns: string }
      encrypt_field: { Args: { _plain: string }; Returns: string }
      expire_stale_pix_transactions: { Args: never; Returns: number }
      get_admin_analytics: { Args: { _period_days?: number }; Returns: Json }
      get_admin_dashboard_data: {
        Args: {
          _from: string
          _product_limit?: number
          _profile_limit?: number
          _to: string
          _tx_limit?: number
          _withdrawal_limit?: number
        }
        Returns: Json
      }
      get_admin_inactive_sellers: {
        Args: { _days_threshold?: number }
        Returns: Json
      }
      get_admin_top_sellers: { Args: { _period_days?: number }; Returns: Json }
      get_affiliate_product_owner: {
        Args: { _product_id: string }
        Returns: string
      }
      get_auth_abuse_stats: { Args: { _hours?: number }; Returns: Json }
      get_card_release_days: { Args: { _user_id: string }; Returns: number }
      get_checkout_status: {
        Args: { _transaction_id: string }
        Returns: string
      }
      get_course_analytics: { Args: { _course_id: string }; Returns: Json }
      get_global_payment_toggles: {
        Args: never
        Returns: {
          boleto: boolean
          credit_card: boolean
          pix: boolean
        }[]
      }
      get_ledger_balance: { Args: { _user_id: string }; Returns: number }
      get_ledger_integrity_report: { Args: never; Returns: Json }
      get_my_max_ticket: { Args: never; Returns: number }
      get_quiz_questions_for_student: {
        Args: { _quiz_id: string }
        Returns: {
          explanation: string
          id: string
          options: Json
          question: string
          quiz_id: string
          sort_order: number
        }[]
      }
      get_staff_commission_balance: {
        Args: { _staff: string }
        Returns: number
      }
      get_user_max_ticket: { Args: { _user_id: string }; Returns: number }
      grade_quiz_attempt: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_staff_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      is_ip_blocked: { Args: { _ip_hash: string }; Returns: boolean }
      is_product_active: { Args: { _product_id: string }; Returns: boolean }
      list_visible_acquirers: {
        Args: never
        Returns: {
          conversion_rate: number
          description: string
          id: string
          is_active: boolean
          name: string
          priority: number
          seller_visible: boolean
          slug: string
          type: string
        }[]
      }
      log_security_event: {
        Args: {
          _actor_role?: string
          _endpoint: string
          _event_type: string
          _ip_hash?: string
          _metadata?: Json
          _status_code?: number
          _user_agent?: string
          _user_id?: string
        }
        Returns: string
      }
      mask_pix: { Args: { _kind: string; _v: string }; Returns: string }
      mask_tail: { Args: { _keep?: number; _v: string }; Returns: string }
      pick_failover_acquirer: {
        Args: { _current_acquirer_id: string }
        Returns: string
      }
      raise_admin_alert: {
        Args: {
          _kind: string
          _message: string
          _metadata: Json
          _severity: string
        }
        Returns: undefined
      }
      reap_stuck_app_deliveries: { Args: never; Returns: number }
      reap_stuck_webhook_deliveries: { Args: never; Returns: number }
      reconcile_stuck_transactions: { Args: never; Returns: number }
      reconcile_stuck_withdrawals: { Args: never; Returns: number }
      release_due_card_holds: { Args: never; Returns: number }
      request_anticipation: {
        Args: { _idempotency_key: string; _max_days: number; _user_id: string }
        Returns: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          idempotency_key: string
          max_days: number
          net_amount: number
          status: string
          transaction_ids: string[]
          tx_count: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_commission_pct: {
        Args: { _seller: string; _staff: string }
        Returns: number
      }
      resolve_commission_staff: { Args: { _seller: string }; Returns: string }
      reverse_transaction_splits: {
        Args: { _tx_id: string }
        Returns: undefined
      }
      run_monitoring_checks: { Args: never; Returns: Json }
      set_max_ticket_for_all: { Args: { _new_value: number }; Returns: Json }
      set_max_ticket_new_users_only: {
        Args: { _new_value: number }
        Returns: Json
      }
      touch_api_key: { Args: { _api_key_id: string }; Returns: undefined }
      validate_coupon: {
        Args: { _amount: number; _code: string; _product_id: string }
        Returns: {
          apply_to_bumps: boolean
          coupon_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
          error: string
          valid: boolean
        }[]
      }
      verify_api_secret: {
        Args: { _hash: string; _prefix: string }
        Returns: {
          api_key_id: string
          ip_allowlist: string[]
          permissions: string[]
          user_id: string
        }[]
      }
      verify_certificate: {
        Args: { _code: string }
        Returns: {
          code: string
          course_title: string
          id: string
          issued_at: string
          student_name: string
          total_lessons: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "employee" | "manager"
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
      app_role: ["admin", "user", "employee", "manager"],
    },
  },
} as const
