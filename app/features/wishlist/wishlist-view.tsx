'use client';

import { useState } from 'react';
import {
  Archive,
  Check,
  CircleDollarSign,
  Edit3,
  Gift,
  PackageCheck,
  Plus,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { formatDate, money } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { Avatar, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, PurchaseIdea, PurchaseVote, T } from '../types';
import {
  sortWishlistIdeas,
  wishlistSummary,
  wishlistVoteScore,
  type WishlistSort,
} from './wishlist-calculations';

export function WishlistView({
  data,
  post,
  t,
  language,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const [sort, setSort] = useState<WishlistSort>('support');
  const [editingId, setEditingId] = useState<number | null>(null);
  const summary = wishlistSummary(data.purchaseIdeas, data.purchaseVotes);
  const sortedIdeas = sortWishlistIdeas(
    data.purchaseIdeas,
    data.purchaseVotes,
    sort,
  );
  const openIdeas = sortedIdeas.filter((idea) => idea.status === 'open');
  const boughtIdeas = sortedIdeas.filter((idea) => idea.status === 'bought');
  const archivedIdeas = sortedIdeas.filter(
    (idea) => idea.status === 'archived',
  );
  const cards = (ideas: PurchaseIdea[]) =>
    ideas.map((idea) => (
      <PurchaseIdeaCard
        key={idea.id}
        idea={idea}
        votes={data.purchaseVotes.filter((vote) => vote.ideaId === idea.id)}
        editing={editingId === idea.id}
        setEditing={(editing) => setEditingId(editing ? idea.id : null)}
        post={post}
        t={t}
        language={language}
      />
    ));
  return (
    <>
      <PageTitle
        eyebrow={t('wishlistEyebrow')}
        title={t('houseWishlist')}
        copy={t('wishlistCopy')}
      />
      <div className="wishlist-summary-grid">
        <article className="panel wishlist-summary">
          <span className="tinted-icon peach">
            <Gift size={19} />
          </span>
          <div>
            <strong>{summary.openCount}</strong>
            <span>{t('openIdeas')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon green">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <strong>{money(summary.estimatedOpenCost, language)}</strong>
            <span>{t('estimatedWishlistCost')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon blue">
            <ThumbsUp size={19} />
          </span>
          <div>
            <strong>{summary.openVoteCount}</strong>
            <span>{t('householdVotes')}</span>
          </div>
        </article>
      </div>
      <article className="panel wishlist-entry-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('suggestPurchase')}</h2>
            <span>{t('wishlistAlwaysShared')}</span>
          </div>
          <span className="privacy-badge shared">
            <Users size={11} /> {t('shared')}
          </span>
        </div>
        <form
          className="wishlist-form"
          onSubmit={(event) => submitForm(event, post, 'purchase-idea')}
        >
          <Field
            name="title"
            label={t('itemName')}
            placeholder={t('itemNamePlaceholder')}
          />
          <label className="form-field">
            <span>{t('estimatedCostOptional')}</span>
            <input
              name="estimatedCost"
              type="number"
              min="0"
              step="any"
              placeholder="0"
            />
          </label>
          <label className="form-field wishlist-description">
            <span>{t('whyBuyIt')}</span>
            <textarea
              name="description"
              maxLength={800}
              placeholder={t('whyBuyItPlaceholder')}
            />
          </label>
          <button className="primary-button">
            <Plus size={16} />
            {t('addIdea')}
          </button>
        </form>
      </article>
      <div className="wishlist-toolbar">
        <span>{t('wishlistResults', { count: openIdeas.length })}</span>
        <label>
          <span>{t('sortWishlist')}</span>
          <select
            aria-label={t('sortWishlist')}
            value={sort}
            onChange={(event) => setSort(event.target.value as WishlistSort)}
          >
            <option value="support">{t('mostSupported')}</option>
            <option value="newest">{t('newestFirst')}</option>
            <option value="cost-asc">{t('lowestCost')}</option>
            <option value="cost-desc">{t('highestCost')}</option>
          </select>
        </label>
      </div>
      <div className="wishlist-card-grid">
        {openIdeas.length ? (
          cards(openIdeas)
        ) : (
          <article className="panel">
            <Empty>{t('noPurchaseIdeas')}</Empty>
          </article>
        )}
      </div>
      {boughtIdeas.length > 0 && (
        <section className="wishlist-bought-section">
          <div className="panel-heading">
            <div>
              <h2>{t('boughtForHome')}</h2>
              <span>{t('boughtForHomeCopy')}</span>
            </div>
            <PackageCheck size={19} />
          </div>
          <div className="wishlist-card-grid">{cards(boughtIdeas)}</div>
        </section>
      )}
      {archivedIdeas.length > 0 && (
        <details className="panel wishlist-archive">
          <summary>
            <span>
              <Archive size={17} />
              {t('wishlistArchive')}
            </span>
            <span>
              {t('archivedIdeasCount', { count: archivedIdeas.length })}
            </span>
          </summary>
          <p>{t('wishlistArchiveCopy')}</p>
          <div className="wishlist-card-grid">{cards(archivedIdeas)}</div>
        </details>
      )}
    </>
  );
}

function PurchaseIdeaCard({
  idea,
  votes,
  editing,
  setEditing,
  post,
  t,
  language,
}: {
  idea: PurchaseIdea;
  votes: PurchaseVote[];
  editing: boolean;
  setEditing: (editing: boolean) => void;
  post: Post;
  t: T;
  language: Language;
}) {
  const yesVotes = votes.filter((vote) => vote.vote === 1);
  const noVotes = votes.filter((vote) => vote.vote === -1);
  const myVote = votes.find((vote) => vote.mine)?.vote || 0;
  const score = wishlistVoteScore(idea.id, votes);
  return (
    <article className={`panel wishlist-card ${idea.status}`}>
      <header>
        <Avatar person={idea} />
        <div>
          <span>{t('suggestedBy', { name: idea.createdByName })}</span>
          <h2>{idea.title}</h2>
        </div>
        {idea.status !== 'open' && (
          <span className="purchase-bought-badge">
            {idea.status === 'bought' ? (
              <Check size={12} />
            ) : (
              <Archive size={12} />
            )}
            {t(idea.status === 'bought' ? 'bought' : 'archived')}
          </span>
        )}
      </header>
      {editing ? (
        <form
          className="wishlist-edit-form"
          onSubmit={async (event) => {
            const saved = await submitForm(
              event,
              post,
              'purchase-idea-update',
              { id: String(idea.id) },
            );
            if (saved) setEditing(false);
          }}
        >
          <Field name="title" label={t('itemName')} defaultValue={idea.title} />
          <label className="form-field">
            <span>{t('estimatedCostOptional')}</span>
            <input
              name="estimatedCost"
              type="number"
              min="0"
              step="any"
              defaultValue={idea.estimatedCost ?? ''}
            />
          </label>
          <label className="form-field full-width">
            <span>{t('whyBuyIt')}</span>
            <textarea
              name="description"
              maxLength={800}
              defaultValue={idea.description}
            />
          </label>
          <div className="inline-form-actions full-width">
            <button className="primary-button compact-button">
              {t('save')}
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setEditing(false)}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        idea.description && <p>{idea.description}</p>
      )}
      <div className="wishlist-cost-score">
        <span>
          {idea.estimatedCost
            ? money(Number(idea.estimatedCost), language)
            : t('noCostEstimate')}
        </span>
        <strong className={score < 0 ? 'negative' : ''}>
          {score > 0 ? '+' : ''}
          {score} {t('voteScore')}
        </strong>
      </div>
      <span className="wishlist-updated">
        {t('wishlistUpdated', {
          date: formatDate(idea.updatedAt.slice(0, 10), language),
        })}
      </span>
      <div className="vote-breakdown">
        <div>
          <span>
            <ThumbsUp size={14} />
            {t('forPurchase')} · {yesVotes.length}
          </span>
          <span className="avatar-stack">
            {yesVotes.slice(0, 5).map((vote) => (
              <span title={vote.name} key={vote.id}>
                <Avatar person={vote} small />
              </span>
            ))}
          </span>
        </div>
        <div>
          <span>
            <ThumbsDown size={14} />
            {t('againstPurchase')} · {noVotes.length}
          </span>
          <span className="avatar-stack">
            {noVotes.slice(0, 5).map((vote) => (
              <span title={vote.name} key={vote.id}>
                <Avatar person={vote} small />
              </span>
            ))}
          </span>
        </div>
      </div>
      {idea.status === 'open' && (
        <div className="vote-actions">
          <button
            type="button"
            className={myVote === 1 ? 'active yes' : ''}
            aria-pressed={myVote === 1}
            onClick={() =>
              void post({
                type: 'purchase-vote',
                id: idea.id,
                vote: myVote === 1 ? 0 : 1,
              })
            }
          >
            <ThumbsUp size={15} />
            {t('voteFor')}
          </button>
          <button
            type="button"
            className={myVote === -1 ? 'active no' : ''}
            aria-pressed={myVote === -1}
            onClick={() =>
              void post({
                type: 'purchase-vote',
                id: idea.id,
                vote: myVote === -1 ? 0 : -1,
              })
            }
          >
            <ThumbsDown size={15} />
            {t('voteAgainst')}
          </button>
        </div>
      )}
      {idea.status === 'open' && myVote !== 0 && (
        <output className="my-vote-status">
          {t(myVote === 1 ? 'yourVoteFor' : 'yourVoteAgainst')}
        </output>
      )}
      {idea.owned && (
        <footer>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => setEditing(!editing)}
          >
            <Edit3 size={14} />
            {editing ? t('cancel') : t('editIdea')}
          </button>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() =>
              void post({
                type: 'purchase-status',
                id: idea.id,
                status: idea.status === 'open' ? 'bought' : 'open',
              })
            }
          >
            {idea.status === 'open' ? (
              <PackageCheck size={14} />
            ) : (
              <RotateCcw size={14} />
            )}
            {idea.status === 'open' ? t('markBought') : t('moveBackToVoting')}
          </button>
          {idea.status !== 'archived' && (
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                void post({
                  type: 'purchase-status',
                  id: idea.id,
                  status: 'archived',
                })
              }
            >
              <Archive size={14} />
              {t('archiveIdea')}
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
