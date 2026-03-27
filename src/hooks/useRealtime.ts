import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// 实时订阅hooks
export function useRealtimeNotes(callback: (payload: any) => void) {
  useEffect(() => {
    // 订阅notes表的变更
    const subscription = supabase
      .channel('public:notes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notes'
      }, callback)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [callback]);
}

export function useRealtimeFolders(callback: (payload: any) => void) {
  useEffect(() => {
    // 订阅folders表的变更
    const subscription = supabase
      .channel('public:folders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'folders'
      }, callback)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [callback]);
}

export function useRealtimeConnections(callback: (payload: any) => void) {
  useEffect(() => {
    // 订阅connections表的变更
    const subscription = supabase
      .channel('public:connections')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connections'
      }, callback)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [callback]);
}
