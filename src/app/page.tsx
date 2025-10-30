'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Auth from '@/components/Auth';

export default function Journal() {
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMoods, setCalendarMoods] = useState<{[key: string]: string}>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{date: string, content: string, mood: string | null}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isClosingCalendar, setIsClosingCalendar] = useState(false);
  const [journalCache, setJournalCache] = useState<{[key: string]: {content: string, mood: string | null, updated_at: string, attachments?: string[]}}>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('journal-cache');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [isLoadingAllEntries, setIsLoadingAllEntries] = useState(false);
  const [isLoadingCurrentEntry, setIsLoadingCurrentEntry] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [hasLoadedUserData, setHasLoadedUserData] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hasLoadedUserDataRef = useRef(false);
  const isSavingRef = useRef(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [savedAttachments, setSavedAttachments] = useState<string[]>([]);
  const [inlineContent, setInlineContent] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string>('');

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check authentication status
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      // Don't call loadUserData here - let onAuthStateChange handle it
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && !hasLoadedUserDataRef.current && !isLoadingUserData) {
        console.log('Auth state change - loading user data');
        loadUserData(session.user);
      } else if (!session?.user) {
        setContent('');
        setUserName('');
        setSelectedMood(null);
        setLastSaved(null);
        setHasLoadedUserData(false);
        setIsLoadingUserData(false);
        setJournalCache({});
        hasLoadedUserDataRef.current = false;
        // Clear localStorage on logout
        localStorage.removeItem('journal-cache');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (user: any) => {
    if (hasLoadedUserDataRef.current) {
      console.log('User data already loaded, skipping');
      return;
    }
    
    console.log('loadUserData called for user:', user.id);
    hasLoadedUserDataRef.current = true;
    
    // Check if we have cache in localStorage first - if we do, load it immediately without loading states
    const savedCache = localStorage.getItem('journal-cache');
    if (savedCache && Object.keys(JSON.parse(savedCache)).length > 0) {
      console.log('Using cached data from localStorage - no loading states');
      const cache = JSON.parse(savedCache);
      setJournalCache(cache);
      
      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      
      if (profile?.name && profile.name !== 'bendyakov') {
        setUserName(profile.name);
      } else {
        const properName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        setUserName(properName);
      }
      
      // Load current day from cache - no loading states
      await loadJournalEntryFromCache(cache, user.id);
      setHasLoadedUserData(true);
      return;
    }
    
    // Only show loading states if we don't have cache
    console.log('No cache found, loading from database with loading states');
    setIsLoadingUserData(true);
    setIsLoadingCurrentEntry(true);
    
    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    
    console.log('Profile data:', profile);
    console.log('Profile error:', profileError);
    
    if (profile?.name && profile.name !== 'bendyakov') {
      console.log('Using profile name:', profile.name);
      setUserName(profile.name);
    } else {
      // Update profile with proper name from user metadata
      const properName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      console.log('Updating profile name to:', properName);
      
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: properName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('name')
        .single();
      
      setUserName(updatedProfile?.name || properName);
    }

    const cache = await loadAllJournalEntries(user.id);
    await loadJournalEntryFromCache(cache, user.id);
    
    setIsLoadingCurrentEntry(false);
    setIsLoadingUserData(false);
    setHasLoadedUserData(true);
  };

  const loadAllJournalEntries = async (userId: string) => {
    setIsLoadingAllEntries(true);
        try {
          const { data, error } = await supabase
            .from('journal_entries')
            .select('date, content, mood, updated_at, attachments')
            .eq('user_id', userId)
            .order('date', { ascending: false });
      
      if (error) {
        console.error('Error loading all journal entries:', error);
        return {};
      }
      
      // Create cache object with date as key
      const cache: {[key: string]: {content: string, mood: string | null, updated_at: string, attachments?: string[]}} = {};
      data?.forEach(entry => {
        console.log('Loading entry for date:', entry.date);
        cache[entry.date] = {
          content: entry.content || '',
          mood: entry.mood,
          attachments: entry.attachments || [],
          updated_at: entry.updated_at
        };
      });
      
      setJournalCache(cache);
      // Save to localStorage for persistence across tab switches
      localStorage.setItem('journal-cache', JSON.stringify(cache));
      console.log('Loaded', Object.keys(cache).length, 'journal entries into cache');
      console.log('Cache dates:', Object.keys(cache));
      
      return cache;
    } catch (error) {
      console.error('Error loading all journal entries:', error);
      return {};
    } finally {
      setIsLoadingAllEntries(false);
    }
  };

  const loadJournalEntryFromCache = async (cache: {[key: string]: {content: string, mood: string | null, updated_at: string, attachments?: string[]}}, userId: string) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Debug: Log what we're looking for and what's in cache
    console.log('Looking for date:', dateStr);
    console.log('Available cache dates:', Object.keys(cache));
    
    // Set editing flag to false when loading data
    setIsUserEditing(false);
    
        // Check cache first
        if (cache[dateStr]) {
          const entry = cache[dateStr];
          setContent(entry.content);
          setSelectedMood(entry.mood);
          setLastSaved(new Date(entry.updated_at));
          setSavedAttachments(entry.attachments || []);
          
          // Load content into contenteditable div
          const editor = document.getElementById('inline-editor') as HTMLDivElement;
          if (editor) {
            editor.innerHTML = entry.content || '';
            setInlineContent(entry.content || '');
            
            // Add click handlers to existing images in the loaded HTML content
            setTimeout(() => {
              const existingImages = editor.querySelectorAll('img');
              existingImages.forEach(img => {
                img.style.cursor = 'pointer';
                img.style.transition = 'transform 0.2s ease';
                
                img.onmouseenter = () => {
                  img.style.transform = 'scale(1.02)';
                };
                img.onmouseleave = () => {
                  img.style.transform = 'scale(1)';
                };
                
                img.onclick = () => {
                  openImageModal(img.src);
                };
              });
            }, 100);
          }
          
          console.log('Loaded entry from cache for', dateStr);
          return;
        }
        
        // If no cache entry, clear content and mood
        setContent('');
        setSelectedMood(null);
        setLastSaved(null);
        setSavedAttachments([]);
        
        // Clear the contenteditable div
        const editor = document.getElementById('inline-editor') as HTMLDivElement;
        if (editor) {
          editor.innerHTML = '';
        }
        
        console.log('No cache entry for', dateStr, '- cleared content and mood');
  };

  const loadJournalEntry = async (userId: string) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Debug: Log what we're looking for and what's in cache
    console.log('Looking for date:', dateStr);
    console.log('Available cache dates:', Object.keys(journalCache));
    
    // Set editing flag to false when loading data
    setIsUserEditing(false);
    
        // Check cache first
        if (journalCache[dateStr]) {
          const entry = journalCache[dateStr];
          setContent(entry.content);
          setSelectedMood(entry.mood);
          setLastSaved(new Date(entry.updated_at));
          setSavedAttachments(entry.attachments || []);
          
          // Load content into contenteditable div
          const editor = document.getElementById('inline-editor') as HTMLDivElement;
          if (editor) {
            editor.innerHTML = entry.content || '';
            setInlineContent(entry.content || '');
            
            // Add click handlers to existing images in the loaded HTML content
            setTimeout(() => {
              const existingImages = editor.querySelectorAll('img');
              existingImages.forEach(img => {
                img.style.cursor = 'pointer';
                img.style.transition = 'transform 0.2s ease';
                
                img.onmouseenter = () => {
                  img.style.transform = 'scale(1.02)';
                };
                img.onmouseleave = () => {
                  img.style.transform = 'scale(1)';
                };
                
                img.onclick = () => {
                  openImageModal(img.src);
                };
              });
            }, 100);
          }
          
          console.log('Loaded from cache:', dateStr, entry);
          return;
        }
    
        // If not in cache, set empty values
        setContent('');
        setSelectedMood(null);
        setLastSaved(null);
        setAttachments([]);
        setSavedAttachments([]);
        
        // Clear contenteditable div
        const editor = document.getElementById('inline-editor') as HTMLDivElement;
        if (editor) {
          editor.innerHTML = '';
        }
        
        console.log('No cache entry for', dateStr, '- cleared content and mood');
  };

  const uploadAttachments = async (files: File[]): Promise<string[]> => {
    if (!user || files.length === 0) return [];
    
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('journal-attachments')
        .upload(fileName, file);
      
      if (error) {
        console.error('Error uploading file:', error);
        return null;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('journal-attachments')
        .getPublicUrl(fileName);
      
      return publicUrl;
    });
    
    const results = await Promise.all(uploadPromises);
    return results.filter(url => url !== null) as string[];
  };

  const saveJournalEntry = async () => {
    if (!user) return;

    // Preserve cursor position and scroll position during save
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const editor = document.getElementById('inline-editor') as HTMLDivElement;
    let cursorPosition: { node: Node; offset: number } | null = null;
    
    if (editor) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorPosition = {
          node: range.startContainer,
          offset: range.startOffset
        };
      }
    }

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Saving journal entry for date:', dateStr, 'content:', content, 'mood:', selectedMood, 'attachments:', attachments.length);
      
      // Upload new attachments if any
      let newAttachmentUrls: string[] = [];
      if (attachments.length > 0) {
        console.log('Uploading', attachments.length, 'attachments...');
        newAttachmentUrls = await uploadAttachments(attachments);
        console.log('Uploaded attachments:', newAttachmentUrls);
      }
      
      // Get current HTML content from editor
      const editor = document.getElementById('inline-editor') as HTMLDivElement;
      let currentHtmlContent = editor ? editor.innerHTML : content;
      
      // Replace any blob URLs with Supabase URLs in the HTML content
      if (newAttachmentUrls.length > 0) {
        // Get all images in the editor
        const images = editor?.querySelectorAll('img') || [];
        images.forEach((img, index) => {
          // If this image has a blob URL and we have a corresponding Supabase URL
          if (img.src.startsWith('blob:') && newAttachmentUrls[index]) {
            currentHtmlContent = currentHtmlContent.replace(img.src, newAttachmentUrls[index]);
          }
        });
      }
      
      // Combine saved attachments with new ones
      const allAttachmentUrls = [...savedAttachments, ...newAttachmentUrls];
      
      // First, try to update existing entry
      const { data: existingEntry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .single();

      if (existingEntry) {
        // Update existing entry
        console.log('Updating existing entry for', dateStr);
        const { error } = await supabase
          .from('journal_entries')
          .update({
            content: currentHtmlContent,
            mood: selectedMood,
            attachments: allAttachmentUrls,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEntry.id);

          if (!error) {
            setLastSaved(new Date());
            setShowSavedIndicator(true);
            setTimeout(() => setShowSavedIndicator(false), 2000);
            
            // Move uploaded files to saved attachments
            setSavedAttachments(allAttachmentUrls);
            setAttachments([]);
            
            // Update cache only if content actually changed
            const currentCacheEntry = journalCache[dateStr];
            if (!currentCacheEntry || 
                currentCacheEntry.content !== currentHtmlContent || 
                currentCacheEntry.mood !== selectedMood || 
                JSON.stringify(currentCacheEntry.attachments) !== JSON.stringify(allAttachmentUrls)) {
              const newCache = {
                ...journalCache,
                [dateStr]: {
                  content: currentHtmlContent,
                  mood: selectedMood,
                  attachments: allAttachmentUrls,
                  updated_at: new Date().toISOString()
                }
              };
              setJournalCache(newCache);
              // Save to localStorage
              localStorage.setItem('journal-cache', JSON.stringify(newCache));
            }
            
            console.log('Successfully updated entry for', dateStr);
        } else {
          console.error('Error updating entry:', error);
        }
      } else {
        // Insert new entry if there's content OR a mood selected OR attachments
        if (content.trim() || selectedMood || allAttachmentUrls.length > 0) {
          console.log('Inserting new entry for', dateStr);
          const { error } = await supabase
            .from('journal_entries')
            .insert({
              user_id: user.id,
              date: dateStr,
              content: currentHtmlContent || '',
              mood: selectedMood,
              attachments: allAttachmentUrls,
              updated_at: new Date().toISOString()
            });

          if (!error) {
            setLastSaved(new Date());
            setShowSavedIndicator(true);
            setTimeout(() => setShowSavedIndicator(false), 2000);
            
            // Move uploaded files to saved attachments
            setSavedAttachments(allAttachmentUrls);
            setAttachments([]);
            
            // Update cache (always update for new entries)
            const newCache = {
              ...journalCache,
              [dateStr]: {
                content: currentHtmlContent || '',
                mood: selectedMood,
                attachments: allAttachmentUrls,
                updated_at: new Date().toISOString()
              }
            };
            setJournalCache(newCache);
            // Save to localStorage
            localStorage.setItem('journal-cache', JSON.stringify(newCache));
            
            console.log('Successfully inserted entry for', dateStr);
          } else {
            console.error('Error inserting entry:', error);
          }
        } else {
          console.log('No content, mood, or attachments to save for', dateStr);
        }
      }
    } catch (error) {
      console.error('Error saving journal entry:', error);
    } finally {
      // Restore cursor position and scroll position after save
      if (cursorPosition && editor) {
        try {
          const range = document.createRange();
          range.setStart(cursorPosition.node, cursorPosition.offset);
          range.setEnd(cursorPosition.node, cursorPosition.offset);
          
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (error) {
          // If cursor restoration fails, just focus the editor
          editor.focus();
        }
      }
      
      // Restore scroll position
      window.scrollTo(0, scrollTop);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (!user || !isUserEditing || isSavingRef.current) return;

    const saveTimeout = setTimeout(() => {
      if (isSavingRef.current) return; // Double check to prevent multiple saves
      
      // Preserve scroll position before any state changes
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      isSavingRef.current = true;
      setIsSaving(true);
      saveJournalEntry();
      
      setTimeout(() => {
        setIsSaving(false);
        isSavingRef.current = false;
        // Restore scroll position after state changes
        window.scrollTo(0, scrollTop);
      }, 500);
    }, 2500);

    return () => clearTimeout(saveTimeout);
  }, [content, selectedMood, attachments, user, isUserEditing]); // Removed savedAttachments to prevent infinite loop

      // Load journal entry when date changes (user loading is handled in loadUserData)
      useEffect(() => {
        if (user) {
          setIsLoadingCurrentEntry(true);
          // Load from cache first (this will set savedAttachments)
          loadJournalEntry(user.id).then(() => {
            setIsLoadingCurrentEntry(false);
          });
          // Then clear new attachments
          setAttachments([]);
        }
      }, [selectedDate]); // Only trigger on date changes, not user changes

  // Load content into contenteditable when content changes (only when not editing)
  useEffect(() => {
    const editor = document.getElementById('inline-editor') as HTMLDivElement;
    if (editor && content && !isUserEditing) {
      // Only update if the content is actually different
      if (editor.innerHTML !== content) {
        editor.innerHTML = content;
        setInlineContent(content);
      }
    }
  }, [content, isUserEditing]);

  // Handle visibility change to restore content when tab becomes active
  useEffect(() => {
    let lastVisibilityChange = 0;
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      // Throttle to prevent excessive calls
      if (now - lastVisibilityChange < 1000) return;
      lastVisibilityChange = now;
      
      if (!document.hidden && user && content) {
        const editor = document.getElementById('inline-editor') as HTMLDivElement;
        if (editor && editor.innerHTML !== content && editor.innerHTML.trim() === '') {
          // Only restore if editor is actually empty, not just different
          console.log('Restoring content on visibility change');
          editor.innerHTML = content;
          setInlineContent(content);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [content, user]);




  const handleNameChange = async (newName: string) => {
    setUserName(newName);
    setIsEditingName(false);
    
    if (user) {
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: newName,
          updated_at: new Date().toISOString()
        });
    }
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 17) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsUserEditing(true);
    
    // Auto-resize textarea while preserving scroll position
    const textarea = e.target;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const textareaRect = textarea.getBoundingClientRect();
    const textareaBottom = textareaRect.bottom;
    
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    
    // Restore scroll position to keep textarea bottom in same position
    const newTextareaRect = textarea.getBoundingClientRect();
    const newTextareaBottom = newTextareaRect.bottom;
    const heightDifference = newTextareaBottom - textareaBottom;
    
    if (heightDifference !== 0) {
      window.scrollTo(0, scrollTop + heightDifference);
    }
  };

  const loadSavedAttachmentsInline = (urls: string[]) => {
    const editor = document.getElementById('inline-editor') as HTMLDivElement;
    if (!editor || urls.length === 0) return;

    // Check if attachments are already loaded in the editor
    const existingAttachments = editor.querySelectorAll('.inline-attachment');
    if (existingAttachments.length > 0) return; // Don't reload if already present

    urls.forEach(url => {
      const fileName = url.split('/').pop() || 'file';
      const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      
      // Create a mock file object for the insertAttachmentInline function
      const mockFile = {
        name: fileName,
        type: isImage ? 'image/jpeg' : 'application/octet-stream'
      } as File;
      
      insertAttachmentInline(mockFile, url);
    });
  };

  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setModalImageUrl('');
  };

  const insertAttachmentInline = (file: File, url?: string) => {
    const editor = document.getElementById('inline-editor') as HTMLDivElement;
    if (!editor) return;

    // Ensure editor is focused
    editor.focus();

    // Create attachment element
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'inline-attachment';
    attachmentDiv.style.cssText = `
      display: inline-block;
      margin: 8px 4px;
      vertical-align: top;
      position: relative;
    `;

    const fileName = file.name;
    const isImage = file.type.startsWith('image/');
    // Always use the provided URL if available (from Supabase), otherwise create object URL
    const fileUrl = url || URL.createObjectURL(file);

    if (isImage) {
      // Create image element
      const img = document.createElement('img');
      img.src = fileUrl;
      img.alt = fileName;
      img.style.cssText = `
        max-width: 200px;
        max-height: 150px;
        border-radius: 8px;
        border: 1px solid var(--border);
        object-fit: cover;
        display: block;
        cursor: pointer;
        transition: transform 0.2s ease;
      `;
      
      // Add hover effect
      img.onmouseenter = () => {
        img.style.transform = 'scale(1.02)';
      };
      img.onmouseleave = () => {
        img.style.transform = 'scale(1)';
      };
      
      // Add click handler to open modal
      img.onclick = () => {
        openImageModal(fileUrl);
      };
      
      attachmentDiv.appendChild(img);
    } else {
      // Create file card
      const fileCard = document.createElement('div');
      fileCard.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background-color: var(--muted);
        border: 1px solid var(--border);
        border-radius: 8px;
        max-width: 200px;
      `;
      
      const icon = document.createElement('div');
      icon.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted-foreground)">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      `;
      
      const fileNameSpan = document.createElement('span');
      fileNameSpan.textContent = fileName.length > 15 ? fileName.substring(0, 15) + '...' : fileName;
      fileNameSpan.style.cssText = `
        font-size: 12px;
        color: var(--foreground);
        white-space: nowrap;
        overflow: hidden;
      `;
      
      fileCard.appendChild(icon);
      fileCard.appendChild(fileNameSpan);
      attachmentDiv.appendChild(fileCard);
    }

    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = `
      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    removeBtn.style.cssText = `
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: var(--destructive);
      color: var(--destructive-foreground);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    
    removeBtn.onclick = () => {
      attachmentDiv.remove();
      setIsUserEditing(true);
      
      // If this is a saved attachment (has URL), remove it from savedAttachments
      if (url) {
        setSavedAttachments(prev => prev.filter(savedUrl => savedUrl !== url));
      }
    };
    
    attachmentDiv.onmouseenter = () => removeBtn.style.opacity = '1';
    attachmentDiv.onmouseleave = () => removeBtn.style.opacity = '0';
    
    attachmentDiv.appendChild(removeBtn);

    // Insert at cursor position
    const selection = window.getSelection();
    let range: Range;
    
    // Check if we have a stored range (from file picker)
    if ((window as any).storedRange) {
      range = (window as any).storedRange;
      delete (window as any).storedRange; // Clean up
    } else if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      // Fallback: append to end and position cursor
      editor.appendChild(attachmentDiv);
      const br = document.createElement('br');
      editor.appendChild(br);
      
      // Position cursor at the end
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      newRange.selectNodeContents(editor);
      newRange.collapse(false);
      newSelection?.removeAllRanges();
      newSelection?.addRange(newRange);
      return;
    }
    
    // Insert the attachment
    range.insertNode(attachmentDiv);
    
    // Add line break after attachment
    const br = document.createElement('br');
    range.insertNode(br);
    
    // Position cursor after the line break
    range.setStartAfter(br);
    range.setEndAfter(br);
    range.collapse(true);
    
    // Update selection
    selection?.removeAllRanges();
    selection?.addRange(range);

    setIsUserEditing(true);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setContent('');
    setUserName('');
    setShowProfileDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
      if (!target.closest('.calendar-popup')) {
        closeCalendar();
      }
    };

    if (showProfileDropdown || showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown, showCalendar]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getShortDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      day: 'numeric' 
    });
  };

  const getDaysInWeek = () => {
    const days = [];
    
    // On mobile, show 5 days (2 before, selected, 2 after). On desktop, show 7 days (3 before, selected, 3 after)
    const range = isMobile ? 2 : 3;
    
    for (let i = -range; i <= range; i++) {
      const day = new Date(selectedDate);
      day.setDate(selectedDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(selectedDate.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    const today = new Date();
    
    // Only allow navigation to next day if it's not in the future
    if (nextDay <= today) {
      setSelectedDate(nextDay);
    }
  };

  const loadCalendarMoods = async () => {
    // Use cache instead of database call
    const moodMap: {[key: string]: string} = {};
    Object.entries(journalCache).forEach(([date, entry]) => {
      if (entry.mood) {
        moodMap[date] = entry.mood;
      }
    });
    
    setCalendarMoods(moodMap);
  };

  const moods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😰', label: 'Anxious' },
    { emoji: '😴', label: 'Tired' }
  ];

  const moodColors: {[key: string]: string} = {
    'Happy': '#FFB347',      // Warm orange - energetic and cheerful
    'Calm': '#87CEEB',       // Sky blue - peaceful and serene
    'Sad': '#708090',        // Slate gray - subdued and melancholic
    'Anxious': '#FF6B6B',    // Coral red - alert and tense
    'Tired': '#9370DB'       // Medium purple - subdued and sleepy
  };

  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const openCalendar = () => {
    setShowCalendar(true);
    loadCalendarMoods(); // This now uses cache
  };

  const closeCalendar = () => {
    setIsClosingCalendar(true);
    setTimeout(() => {
      setShowCalendar(false);
      setIsClosingCalendar(false);
      setSearchQuery('');
      setSearchResults([]);
    }, 200);
  };

  const selectDateFromCalendar = (date: Date) => {
    setSelectedDate(date);
    closeCalendar();
  };

  // Helper function to strip HTML tags and get plain text
  const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  // Helper function to get context around search term
  const getSearchContext = (text: string, query: string, contextLength: number = 50) => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) {
      console.log('Search term not found in text:', query, 'in:', text.substring(0, 100));
      return text.substring(0, 100) + '...'; // Fallback to first 100 chars
    }
    
    console.log('Found search term at index:', index, 'in text:', text.substring(Math.max(0, index - 20), index + 20));
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);
    
    let context = text.substring(start, end);
    
    // Add ellipsis if we're not at the beginning/end
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    console.log('Context extracted:', context);
    return context;
  };

  // Helper function to highlight search terms
  const highlightSearchTerm = (text: string, query: string) => {
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const highlighted = text.replace(regex, '<span style="color: var(--primary); font-weight: 600;">$1</span>');
    
    console.log('Highlighting query:', query);
    console.log('Escaped query:', escapedQuery);
    console.log('Original text:', text);
    console.log('Highlighted result:', highlighted);
    
    return highlighted;
  };

  const searchJournalEntries = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Search through cache instead of database
    const results = Object.entries(journalCache)
      .filter(([date, entry]) => {
        const plainText = stripHtml(entry.content);
        return plainText.toLowerCase().includes(query.toLowerCase());
      })
      .map(([date, entry]) => {
        const plainText = stripHtml(entry.content);
        const context = getSearchContext(plainText, query);
        const highlightedContext = highlightSearchTerm(context, query);
        
        // Debug: Log the highlighting
        console.log('Query:', query);
        console.log('Context:', context);
        console.log('Highlighted:', highlightedContext);
        
        return {
          date,
          content: highlightedContext, // Return highlighted context
          mood: entry.mood
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchJournalEntries(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (loading) {
  return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div 
          className="text-lg"
          style={{ color: 'var(--foreground)' }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {
      // The auth state change will handle setting the user
      // This callback is mainly for UI feedback
    }} />;
  }

  return (
    <>
      {/* Top Header (scrolls with page) */}
      <div className="w-full flex items-center justify-between px-4 sm:px-8 pt-3 sm:pt-4">
        <div>
          <img 
            src="/logo.png" 
            alt="Auri Logo" 
            className="h-8 sm:h-12 w-auto transition-opacity duration-200 hover:opacity-80"
          />
        </div>

        {/* Profile Dropdown */}
        <div className="relative profile-dropdown">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-200 hover:scale-105 flex items-center justify-center"
            style={{ 
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
            title="Profile"
          >
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm sm:text-lg font-semibold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </button>
          
          {/* Dropdown Menu */}
          {showProfileDropdown && (
            <div 
              className="absolute right-0 mt-2 w-72 sm:w-64 rounded-lg shadow-lg z-50"
              style={{ 
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {user?.user_metadata?.avatar_url ? (
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: 'var(--primary-foreground)' }}>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {userName}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {user?.email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 mb-2">
                  <div className="flex items-center gap-3">
                    {isDarkMode ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--foreground)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--foreground)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    <span style={{ color: 'var(--foreground)' }}>
                      {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </div>
                  
                  {/* iOS-style Toggle Switch */}
                  <button
                    onClick={toggleDarkMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    style={{
                      backgroundColor: isDarkMode ? 'var(--primary)' : 'var(--muted)'
                    }}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out ${
                        isDarkMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                      style={{
                        backgroundColor: 'var(--background)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </button>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full p-3 rounded-lg transition-colors text-left flex items-center gap-3"
                  style={{ 
                    backgroundColor: 'var(--destructive)',
                    color: 'var(--destructive-foreground)'
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="min-h-screen flex flex-col items-center pt-24 sm:pt-24 pb-8 sm:pb-16 px-4 sm:px-8" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-4xl w-full px-2 sm:px-0">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          
          <div className="mb-4">
            {isEditingName ? (
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onBlur={() => handleNameChange(userName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNameChange(userName);
                  }
                }}
                className="text-2xl sm:text-4xl font-light bg-transparent border-none outline-none text-center w-full"
                style={{ color: 'var(--foreground)' }}
                autoFocus
              />
            ) : (
              <h1 
                className="text-2xl sm:text-4xl font-light cursor-pointer transition-colors"
                style={{ color: 'var(--foreground)' }}
                onClick={() => setIsEditingName(true)}
              >
                {getTimeBasedGreeting()}, {userName}!
          </h1>
            )}
          </div>
          <p className="text-lg sm:text-xl" style={{ color: 'var(--muted-foreground)' }}>{formatDate(selectedDate)}</p>
        </div>

        {/* Date Navigation */}
        <div className="flex flex-col items-center mb-8 sm:mb-16 calendar-navigation">
          <div className="flex items-center gap-2 sm:gap-4 mb-4 calendar-days-container w-full justify-center py-2">
            {/* Previous Day Arrow */}
            <button
              onClick={goToPreviousDay}
              className="p-1.5 sm:p-3 rounded-full transition-all duration-200 cursor-pointer hover:scale-105 hover:bg-opacity-10 flex items-center justify-center flex-shrink-0"
              style={{ 
                backgroundColor: 'var(--muted)',
                color: 'var(--foreground)',
                minWidth: '40px',
                minHeight: '40px'
              }}
              title="Previous day"
            >
              <svg className="w-3 h-3 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Calendar Days */}
            <div className="flex gap-1 sm:gap-3 items-center flex-shrink-0 overflow-visible">
              {getDaysInWeek().map((day, index) => {
                const today = new Date();
                const isToday = day.toDateString() === today.toDateString();
                const isSelected = day.toDateString() === selectedDate.toDateString();
                const isCenter = isMobile ? index === 2 : index === 3; // Center position (selected date)
                const isFuture = day > today;
                const isPast = day < today;
                
                return (
                  <button
                    key={index}
                    onClick={() => !isFuture && setSelectedDate(day)}
                    disabled={isFuture}
                    className={`${isCenter ? 'w-14 h-14 sm:w-20 sm:h-20' : 'w-11 h-11 sm:w-15 sm:h-15'} rounded-xl transition-all duration-300 flex flex-col items-center justify-center overflow-visible ${
                      isFuture ? 'cursor-default' : 'cursor-pointer hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                      border: isSelected ? '2px solid var(--border)' : '1px solid var(--border)',
                      boxShadow: isSelected ? 'var(--shadow-lg)' : isCenter ? 'var(--shadow-md)' : 'none',
                      opacity: isFuture ? 0.5 : isPast ? 0.8 : 1,
                      transform: 'scale(1)'
                    }}
                  >
                    <span 
                      className="text-xs font-medium"
                      style={{ 
                        color: isFuture ? 'var(--muted-foreground)' : isPast ? 'var(--foreground)' : 'var(--foreground)'
                      }}
                    >
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span 
                      className={`font-semibold ${isCenter ? 'text-lg' : 'text-base'}`}
                      style={{ 
                        color: isFuture ? 'var(--muted-foreground)' : isPast ? 'var(--foreground)' : 'var(--foreground)'
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Next Day Arrow */}
            <button
              onClick={goToNextDay}
              disabled={selectedDate.toDateString() === new Date().toDateString()}
              className={`p-1.5 sm:p-3 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                selectedDate.toDateString() === new Date().toDateString() 
                  ? 'cursor-default opacity-50' 
                  : 'cursor-pointer hover:scale-105 hover:bg-opacity-10'
              }`}
              style={{ 
                backgroundColor: 'var(--muted)',
                color: 'var(--foreground)',
                minWidth: '40px',
                minHeight: '40px'
              }}
              title={selectedDate.toDateString() === new Date().toDateString() ? "Cannot go to future days" : "Next day"}
            >
              <svg className="w-3 h-3 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Button */}
          <button
            onClick={openCalendar}
            className="p-1.5 sm:p-3 rounded-full transition-all duration-200 cursor-pointer hover:scale-105 hover:bg-opacity-10 flex items-center justify-center flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              minWidth: '40px',
              minHeight: '40px'
            }}
            title="Open calendar"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {/* Mood Selector */}
        <div className="text-center mb-8 sm:mb-16">
          <h2 
            className="text-lg sm:text-xl font-medium mb-6 sm:mb-8"
            style={{ color: 'var(--muted-foreground)' }}
          >
            How are you feeling today?
          </h2>
          <div className="flex justify-center gap-2 sm:gap-8 flex-wrap">
            {moods.map((mood) => (
              <button
                key={mood.label}
                    onClick={() => {
                      setSelectedMood(mood.label);
                      setIsUserEditing(true);
                    }}
                className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all duration-200 cursor-pointer ${!selectedMood ? 'mood-pulse' : ''}`}
                style={{
                  backgroundColor: selectedMood === mood.label ? 'var(--accent)' : 'transparent',
                  boxShadow: selectedMood === mood.label ? 'var(--shadow-sm)' : (!selectedMood ? '0 0 0 2px var(--accent)' : 'none')
                }}
                title={!selectedMood ? 'Choose a mood to proceed' : mood.label}
                aria-label={`Mood: ${mood.label}`}
              >
                <span className="text-2xl sm:text-3xl">{mood.emoji}</span>
                <span 
                  className="text-sm sm:text-base font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  {mood.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Step gating: Only show writing area after a mood is selected */}
        {selectedMood ? (
          <>
            {/* Line Break */}
            <div className="mb-8 sm:mb-16">
              <hr style={{ borderColor: 'var(--border)', opacity: 0.3 }} />
            </div>

            {/* Writing Area */}
            <div className="text-center mb-8 sm:mb-16 editor-appear">
              <h2 
                className="text-lg sm:text-xl font-medium mb-6 sm:mb-8"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Take a moment to reflect
              </h2>
              <div 
                className="rounded-2xl shadow-sm relative editor-appear"
                style={{ 
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)'
                }}
              >
                {/* Rich Text Editor Container */}
                <div className="p-4 sm:p-8">
                  {/* Inline Content Editor */}
                  <div
                    id="inline-editor"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const newContent = e.currentTarget.innerHTML;
                      setInlineContent(newContent);
                      // Save the full HTML content (including images)
                      setContent(newContent);
                      setIsUserEditing(true);
                    }}
                    onFocus={() => {
                      // Restore content if it's missing when focused
                      const editor = document.getElementById('inline-editor') as HTMLDivElement;
                      if (editor && content && editor.innerHTML !== content) {
                        editor.innerHTML = content;
                        setInlineContent(content);
                      }
                    }}
                    className="w-full min-h-60 sm:min-h-80 text-base sm:text-lg leading-relaxed custom-cursor text-left"
                    style={{ 
                      color: 'var(--card-foreground)',
                      fontFamily: 'var(--font-sans)',
                      backgroundColor: 'transparent',
                      caretColor: 'var(--foreground)',
                      minHeight: '320px',
                      outline: 'none',
                      whiteSpace: 'pre-wrap',
                      textAlign: 'left'
                    }}
                    data-placeholder="What's on your mind?"
                  />
                </div>
          </div>

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between mt-4 px-2 editor-appear">
            {/* Left side - Toolbar buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Attach Files */}
              <button
                onClick={() => {
                  // Store current cursor position before opening file picker
                  const editor = document.getElementById('inline-editor') as HTMLDivElement;
                  if (editor) {
                    editor.focus();
                    // Store the current selection
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      // Store the range for later use
                      (window as any).storedRange = selection.getRangeAt(0).cloneRange();
                    }
                  }
                  
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '*/*'; // Accept all file types including images
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files.length > 0) {
                      const newFiles = Array.from(files);
                      // Insert each file inline at cursor position
                      newFiles.forEach(file => {
                        insertAttachmentInline(file);
                      });
                      // Also add to attachments for saving
                      setAttachments(prev => [...prev, ...newFiles]);
                    }
                  };
                  input.click();
                }}
                className="p-2 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-opacity-10 flex items-center justify-center"
                style={{ 
                  backgroundColor: 'var(--muted)',
                  color: 'var(--muted-foreground)'
                }}
                title="Attach files (images, documents, etc.)"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Dictation (Microphone) */}
              <button
                className="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-opacity-10 flex items-center justify-center"
                style={{ 
                  backgroundColor: 'var(--muted)',
                  color: 'var(--muted-foreground)'
                }}
                title="Voice dictation (coming soon)"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>

            {/* Right side - Save indicator */}
            <div className="flex items-center gap-1 sm:gap-2">
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--primary)' }}></div>
                  <span className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>Saving...</span>
                </div>
              ) : showSavedIndicator ? (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs sm:text-sm" style={{ color: 'var(--primary)' }}>Saved</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
          </>
        ) : null}

        {/* Footer */}
        <div className="text-center space-y-3">
          <p 
            className="text-base"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Your thoughts are private
          </p>
        </div>
      </div>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${
          isClosingCalendar ? 'calendar-backdrop-exit' : 'calendar-backdrop-enter'
        }`}>
          <div 
            className={`calendar-popup bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 ${
              isClosingCalendar ? 'calendar-popup-exit' : 'calendar-popup-enter'
            }`}
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-2xl)'
            }}
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 
                className="text-lg sm:text-xl font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={closeCalendar}
                className="p-2 rounded-full hover:bg-opacity-10 transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search your journal entries..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full p-2 sm:p-3 pl-8 sm:pl-10 rounded-lg border-none outline-none text-sm"
                  style={{ 
                    backgroundColor: 'var(--input)',
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
                <div className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2">
                  {isSearching ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--muted-foreground)' }}></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--muted-foreground)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="mb-4">
                <h3 
                  className="text-sm font-medium mb-3"
                  style={{ color: 'var(--foreground)' }}
                >
                  Search Results ({searchResults.length})
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const date = new Date(result.date);
                          setSelectedDate(date);
                          closeCalendar();
                        }}
                        className="w-full p-2 sm:p-3 rounded-lg text-left transition-all duration-200 hover:shadow-md cursor-pointer"
                        style={{ 
                          backgroundColor: 'var(--muted)',
                          color: 'var(--foreground)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                          e.currentTarget.style.color = 'var(--accent-foreground)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--muted)';
                          e.currentTarget.style.color = 'var(--foreground)';
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                            {new Date(result.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                          {result.mood && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: moodColors[result.mood] || 'var(--muted-foreground)' }}
                            />
                          )}
        </div>
                        <p 
                          className="text-sm line-clamp-2" 
                          style={{ color: 'var(--foreground)' }}
                          dangerouslySetInnerHTML={{ 
                            __html: result.content
                          }}
                        />
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                      {isSearching ? 'Searching...' : 'No entries found'}
                    </p>
                  )}
    </div>
              </div>
            )}

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div 
                  key={day}
                  className="text-center text-xs sm:text-sm font-medium p-1 sm:p-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {getCalendarDays(selectedDate.getFullYear(), selectedDate.getMonth()).map((day, index) => {
                if (!day) {
                  return <div key={index} className="h-8 sm:h-10" />;
                }
                
                const dayStr = day.toISOString().split('T')[0];
                const mood = calendarMoods[dayStr];
                const isToday = day.toDateString() === new Date().toDateString();
                const isSelected = day.toDateString() === selectedDate.toDateString();
                const isFuture = day > new Date();
                
                return (
                  <button
                    key={index}
                    onClick={() => !isFuture && selectDateFromCalendar(day)}
                    disabled={isFuture}
                    className={`relative h-8 w-8 sm:h-10 sm:w-10 rounded-lg transition-all duration-200 flex flex-col items-center justify-center ${
                      isFuture ? 'cursor-default opacity-50' : 'cursor-pointer hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                      border: isToday ? '2px solid var(--primary)' : '1px solid transparent',
                      color: isFuture ? 'var(--muted-foreground)' : 'var(--foreground)'
                    }}
                  >
                    <span className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{day.getDate()}</span>
                    {mood && (
                      <div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                        style={{ backgroundColor: moodColors[mood] || 'var(--muted-foreground)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>


            {/* Mood Legend */}
            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <h3 
                className="text-sm font-medium mb-3"
                style={{ color: 'var(--foreground)' }}
              >
                Mood Legend
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {moods.map(mood => (
                  <div key={mood.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: moodColors[mood.label] }}
                    />
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {mood.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeImageModal}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img
              src={modalImageUrl}
              alt="Full size image"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Close button */}
            <button
              onClick={closeImageModal}
              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white'
              }}
              title="Close image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
