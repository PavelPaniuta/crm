export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; email: string };
  receiverId?: string;
};

export type ChatContact = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  position?: string | null;
};

export type ChatConversation = {
  user: ChatContact | null;
  lastMessage: (ChatMessage & { body: string }) | null;
  unread: number;
  lastAt: string;
};

export async function fetchChatContacts(): Promise<ChatContact[]> {
  const res = await fetch("/api/chat/users", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchChatConversations(): Promise<ChatConversation[]> {
  const res = await fetch("/api/chat/conversations", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchChatMessages(withUserId: string, limit = 50): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/messages?with=${withUserId}&limit=${limit}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function markChatRead(otherUserId: string): Promise<void> {
  await fetch("/api/chat/read", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherUserId }),
  });
}

export async function sendChatMessageApi(receiverId: string, text: string): Promise<ChatMessage | null> {
  const res = await fetch("/api/chat/messages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, receiverId }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchChatUnreadCount(): Promise<number> {
  try {
    const res = await fetch("/api/chat/unread", { credentials: "include" });
    if (!res.ok) return 0;
    const j = await res.json();
    return j.count ?? 0;
  } catch {
    return 0;
  }
}
