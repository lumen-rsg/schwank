'use client';

import Image from 'next/image';
import { MessageCircle, Send } from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { Avatar, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';

export function ChatView({
  data,
  user,
  post,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
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
            <span>{t('sharedChat', { count: data.messages.length })}</span>
          </div>
        </header>
        <div className="messages">
          {data.messages.length ? (
            data.messages.map((message) => (
              <div
                className={message.mine ? 'message mine' : 'message'}
                key={message.id}
              >
                <Avatar person={message} />
                <div>
                  <span>
                    {message.name} ·{' '}
                    {new Date(message.createdAt).toLocaleTimeString(
                      language === 'ru' ? 'ru-RU' : 'en-US',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </span>
                  <p>{message.body}</p>
                </div>
              </div>
            ))
          ) : (
            <Empty>{t('sayHello')}</Empty>
          )}
        </div>
        <form
          className="chat-compose"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const messageValue = new FormData(form).get('body');
            const body =
              typeof messageValue === 'string' ? messageValue.trim() : '';
            if (body && (await post({ type: 'message', body }))) form.reset();
          }}
        >
          <Avatar person={user} />
          <input
            name="body"
            placeholder={t('messageAs', { name: user.name })}
            autoComplete="off"
            maxLength={2000}
          />
          <button aria-label={t('chat')}>
            <Send size={18} />
          </button>
        </form>
      </article>
    </>
  );
}
