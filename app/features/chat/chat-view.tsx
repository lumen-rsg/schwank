'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  LoaderCircle,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { requestApiJson } from '../../client/api';
import { withFormSubmission } from '../../client/forms';
import { Avatar, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Message, Post, T } from '../types';

type ChatPage = { messages: Message[]; hasMore: boolean };

export function ChatView({
  data,
  user,
  post,
  t,
  language,
  connectionState,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
  connectionState: 'connected' | 'reconnecting';
}) {
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const messages = useMemo(() => {
    const byId = new Map<number, Message>();
    for (const message of [...olderMessages, ...data.messages])
      byId.set(message.id, message);
    return Array.from(byId.values()).sort((left, right) => left.id - right.id);
  }, [data.messages, olderMessages]);
  const hasMore = data.messageCount > messages.length;

  useEffect(() => {
    if (data.unreadMessages > 0)
      void post({ type: 'message-read' }, { quiet: true });
  }, [data.unreadMessages, post]);

  async function loadOlder() {
    const before = messages[0]?.id;
    if (!before || loadingOlder) return;
    setLoadingOlder(true);
    setHistoryError('');
    try {
      const page = await requestApiJson<ChatPage>(
        `/api/chat?before=${before}`,
        { cache: 'no-store' },
        t,
        'storageFailed',
      );
      setOlderMessages((current) => [...page.messages, ...current]);
    } catch (cause) {
      setHistoryError(
        cause instanceof Error ? cause.message : t('storageFailed'),
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  async function updateMessage(id: number, body: string) {
    const saved = await post({ type: 'message-update', id, body });
    if (saved) {
      setOlderMessages((current) =>
        current.map((message) =>
          message.id === id
            ? { ...message, body, editedAt: new Date().toISOString() }
            : message,
        ),
      );
      setEditingId(null);
    }
    return saved;
  }

  async function removeMessage(message: Message) {
    if (!window.confirm(t('deleteMessageWarning'))) return;
    if (await post({ type: 'message-remove', id: message.id }))
      setOlderMessages((current) =>
        current.filter((entry) => entry.id !== message.id),
      );
  }

  return (
    <>
      <PageTitle
        eyebrow={t('chatEyebrow')}
        title={t('houseChat')}
        copy={t('chatCopy')}
      />
      <article className="chat-room panel">
        <header>
          {data.home.photo ? (
            <Image
              className="chat-home-photo"
              src={data.home.photo}
              alt=""
              width={34}
              height={34}
              unoptimized
            />
          ) : (
            <span className="tinted-icon green">
              <MessageCircle size={18} />
            </span>
          )}
          <div>
            <strong>{data.home.name}</strong>
            <span>{t('sharedChat', { count: data.messageCount })}</span>
          </div>
          <output className={`chat-connection ${connectionState}`}>
            {connectionState === 'connected' ? (
              t('chatConnected')
            ) : (
              <>
                <WifiOff size={13} />
                {t('chatReconnecting')}
              </>
            )}
          </output>
        </header>
        <div className="messages">
          {hasMore && (
            <button
              type="button"
              className="load-chat-history"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder && <LoaderCircle className="spin" size={14} />}
              {t('loadOlderMessages')}
            </button>
          )}
          {historyError && <div className="auth-error">{historyError}</div>}
          {messages.length ? (
            messages.map((message) => (
              <div
                className={message.mine ? 'message mine' : 'message'}
                data-notification-target={`chat:${message.id}`}
                key={message.id}
              >
                <Avatar person={message} />
                <div>
                  <span>
                    {message.name} ·{' '}
                    {new Date(message.createdAt).toLocaleString(
                      language === 'ru' ? 'ru-RU' : 'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                    {message.editedAt ? ` · ${t('edited')}` : ''}
                  </span>
                  {editingId === message.id ? (
                    <form
                      className="message-edit-form"
                      onSubmit={(event) =>
                        withFormSubmission(event, async (form) => {
                          const value = new FormData(form).get('body');
                          const body =
                            typeof value === 'string' ? value.trim() : '';
                          if (!body) return false;
                          return updateMessage(message.id, body);
                        })
                      }
                    >
                      <textarea
                        name="body"
                        defaultValue={message.body}
                        maxLength={2000}
                        rows={3}
                      />
                      <span>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          {t('cancel')}
                        </button>
                        <button className="primary-button">{t('save')}</button>
                      </span>
                    </form>
                  ) : (
                    <>
                      <p>{message.body}</p>
                      {Boolean(message.mine) && (
                        <span className="message-actions">
                          <button
                            type="button"
                            aria-label={t('editMessage')}
                            onClick={() => setEditingId(message.id)}
                          >
                            <Pencil size={12} />
                            {t('edit')}
                          </button>
                          <button
                            type="button"
                            aria-label={t('deleteMessage')}
                            onClick={() => void removeMessage(message)}
                          >
                            <Trash2 size={12} />
                            {t('delete')}
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty>{t('sayHello')}</Empty>
          )}
        </div>
        <p className="chat-retention">{t('chatRetention')}</p>
        <form
          className="chat-compose"
          onSubmit={(event) =>
            withFormSubmission(event, async (form) => {
              const messageValue = new FormData(form).get('body');
              const body =
                typeof messageValue === 'string' ? messageValue.trim() : '';
              if (!body) return false;
              const saved = await post({ type: 'message', body });
              if (saved) form.reset();
              return saved;
            })
          }
        >
          <Avatar person={user} />
          <input
            name="body"
            placeholder={t('messageAs', { name: user.name })}
            autoComplete="off"
            maxLength={2000}
          />
          <button aria-label={t('sendMessage')}>
            <Send size={18} />
          </button>
        </form>
      </article>
    </>
  );
}
