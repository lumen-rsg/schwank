import type { PurchaseIdea, PurchaseVote } from '../types';

export type WishlistSort = 'support' | 'newest' | 'cost-asc' | 'cost-desc';

export function wishlistVoteScore(
  ideaId: number,
  votes: PurchaseVote[],
): number {
  return votes
    .filter((vote) => vote.ideaId === ideaId)
    .reduce((score, vote) => score + Number(vote.vote), 0);
}

export function sortWishlistIdeas(
  ideas: PurchaseIdea[],
  votes: PurchaseVote[],
  sort: WishlistSort,
): PurchaseIdea[] {
  return [...ideas].sort((left, right) => {
    if (sort === 'support') {
      const scoreDifference =
        wishlistVoteScore(right.id, votes) - wishlistVoteScore(left.id, votes);
      if (scoreDifference) return scoreDifference;
    }
    if (sort === 'cost-asc' || sort === 'cost-desc') {
      const leftCost = left.estimatedCost;
      const rightCost = right.estimatedCost;
      if (leftCost === null && rightCost !== null) return 1;
      if (rightCost === null && leftCost !== null) return -1;
      if (leftCost !== null && rightCost !== null && leftCost !== rightCost)
        return sort === 'cost-asc'
          ? leftCost - rightCost
          : rightCost - leftCost;
    }
    return (
      Date.parse(right.updatedAt || right.createdAt) -
        Date.parse(left.updatedAt || left.createdAt) || right.id - left.id
    );
  });
}

export function wishlistSummary(ideas: PurchaseIdea[], votes: PurchaseVote[]) {
  const openIdeas = ideas.filter((idea) => idea.status === 'open');
  const openIds = new Set(openIdeas.map((idea) => idea.id));
  return {
    openCount: openIdeas.length,
    estimatedOpenCost: openIdeas.reduce(
      (sum, idea) => sum + Number(idea.estimatedCost || 0),
      0,
    ),
    openVoteCount: votes.filter((vote) => openIds.has(vote.ideaId)).length,
  };
}
