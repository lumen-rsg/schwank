'use client';

import {
  Archive,
  Check,
  CircleDollarSign,
  Gift,
  PackageCheck,
  Plus,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { money } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { Avatar, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, PurchaseIdea, PurchaseVote, T } from '../types';

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
  const openIdeas = data.purchaseIdeas.filter((idea) => idea.status === 'open');
  const boughtIdeas = data.purchaseIdeas.filter(
    (idea) => idea.status === 'bought',
  );
  const estimatedOpenCost = openIdeas.reduce(
    (sum, idea) => sum + Number(idea.estimatedCost || 0),
    0,
  );
  const totalVotes = data.purchaseVotes.length;
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
            <strong>{openIdeas.length}</strong>
            <span>{t('openIdeas')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon green">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <strong>{money(estimatedOpenCost, language)}</strong>
            <span>{t('estimatedWishlistCost')}</span>
          </div>
        </article>
        <article className="panel wishlist-summary">
          <span className="tinted-icon blue">
            <ThumbsUp size={19} />
          </span>
          <div>
            <strong>{totalVotes}</strong>
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
      <div className="wishlist-card-grid">
        {openIdeas.length ? (
          openIdeas.map((idea) => (
            <PurchaseIdeaCard
              key={idea.id}
              idea={idea}
              votes={data.purchaseVotes.filter(
                (vote) => vote.ideaId === idea.id,
              )}
              post={post}
              t={t}
              language={language}
            />
          ))
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
          <div className="wishlist-card-grid">
            {boughtIdeas.map((idea) => (
              <PurchaseIdeaCard
                key={idea.id}
                idea={idea}
                votes={data.purchaseVotes.filter(
                  (vote) => vote.ideaId === idea.id,
                )}
                post={post}
                t={t}
                language={language}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function PurchaseIdeaCard({
  idea,
  votes,
  post,
  t,
  language,
}: {
  idea: PurchaseIdea;
  votes: PurchaseVote[];
  post: Post;
  t: T;
  language: Language;
}) {
  const yesVotes = votes.filter((vote) => vote.vote === 1);
  const noVotes = votes.filter((vote) => vote.vote === -1);
  const myVote = votes.find((vote) => vote.mine)?.vote || 0;
  const score = yesVotes.length - noVotes.length;
  return (
    <article
      className={`panel wishlist-card${idea.status === 'bought' ? ' bought' : ''}`}
    >
      <header>
        <Avatar person={idea} />
        <div>
          <span>{t('suggestedBy', { name: idea.createdByName })}</span>
          <h2>{idea.title}</h2>
        </div>
        {idea.status === 'bought' && (
          <span className="purchase-bought-badge">
            <Check size={12} />
            {t('bought')}
          </span>
        )}
      </header>
      {idea.description && <p>{idea.description}</p>}
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
      {idea.owned && (
        <footer>
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
        </footer>
      )}
    </article>
  );
}
