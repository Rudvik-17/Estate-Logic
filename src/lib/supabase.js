import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://olswwdunaivwxefelasc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sc3d3ZHVuYWl2d3hlZmVsYXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTAyOTgsImV4cCI6MjA5MTMyNjI5OH0.htd8o5Nm44hZqv2fWsxdjToNjlckhZL6NY0aXXjyosw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
