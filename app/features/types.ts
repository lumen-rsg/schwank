import type { AuthUser } from '@/db/auth';
import type { ApiErrorCode } from '@/lib/api-errors';
import type { ReminderRecurrence } from '@/lib/reminders';
import type { CopyKey } from '../i18n';

export type Visibility = 'private' | 'shared';
export type Member = {
  id: number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  role: 'owner' | 'member';
};
export type HomeProfile = {
  name: string;
  address: string;
  photo: string | null;
};
export type Nutrition = {
  id: number;
  userId: number;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  eatenOn: string;
  visibility: Visibility;
  owned: boolean | number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
};
export type NutritionHistoryDay = {
  day: string;
  entryCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Task = {
  id: number;
  title: string;
  status: string;
  tag: string;
  due: string;
  dueOn: string | null;
  visibility: Visibility;
  owned: boolean | number;
  assignedToMe: boolean | number;
  assigneeId: number;
  assigneeName: string | null;
  assigneeInitials: string | null;
  assigneeColor: string | null;
  assigneeAvatar: string | null;
  sourceReminderId: number | null;
};
export type Expense = {
  id: number;
  label: string;
  amount: number;
  category: string;
  spentOn: string;
  recurringPaymentId: number | null;
  visibility: Visibility;
  owned: boolean | number;
};
export type SpendingBudget = {
  id: number;
  category: string;
  monthlyLimit: number;
  updatedAt: string;
};
export type RecurringPayment = {
  id: number;
  kind: 'subscription' | 'loan' | 'rent';
  label: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextDueOn: string;
  remainingAmount: number | null;
  active: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
};
export type Organiser = {
  id: number;
  list: string;
  label: string;
  done: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
};
export type Reminder = {
  id: number;
  label: string;
  remindAt: string;
  recurrence: ReminderRecurrence;
  done: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
  convertedTaskId: number | null;
};
export type Medication = {
  id: number;
  name: string;
  dosage: string;
  instructions: string;
  scheduleTimes: string[];
  startOn: string;
  endOn: string | null;
  supplyRemaining: number | null;
  refillThreshold: number | null;
  active: boolean | number;
  visibility: Visibility;
  owned: boolean | number;
  ownerName: string;
};
export type MedicationDose = {
  id: number;
  medicationId: number;
  scheduledFor: string;
  takenAt: string;
  takenByName: string;
};
export type MedicationAdherenceDose = Pick<
  MedicationDose,
  'medicationId' | 'scheduledFor'
>;
export type PurchaseIdea = {
  id: number;
  title: string;
  description: string;
  estimatedCost: number | null;
  status: 'open' | 'bought' | 'archived';
  createdAt: string;
  updatedAt: string;
  owned: boolean | number;
  createdByName: string;
  initials: string;
  color: string;
  avatar: string | null;
};
export type PurchaseVote = {
  id: number;
  ideaId: number;
  vote: 1 | -1;
  updatedAt: string;
  mine: boolean | number;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
};
export type Message = {
  id: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  mine: boolean | number;
};
export type NotificationPreferences = {
  enabled: boolean | number;
  medicationsEnabled: boolean | number;
  paymentsEnabled: boolean | number;
  tasksEnabled: boolean | number;
  remindersEnabled: boolean | number;
  chatEnabled: boolean | number;
  advanceMinutes: number;
  quietHoursEnabled: boolean | number;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};
export type NotificationState = {
  eventKey: string;
  deliveredAt: string | null;
  snoozedUntil: string | null;
};
export type HabitKind = 'vaping' | 'alcohol';
export type HabitEntry = {
  id: number;
  userId: number;
  habit: HabitKind;
  occurrences: number;
  cost: number;
  occurredOn: string;
  createdAt: string;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  mine: boolean | number;
};
export type HabitHistoryDay = {
  day: string;
  habit: HabitKind;
  entryCount: number;
  occurrences: number;
  cost: number;
};
export type WaterEntry = {
  id: number;
  amountMl: number;
  drunkOn: string;
  createdAt: string;
};
export type WaterHistoryDay = {
  day: string;
  entryCount: number;
  amountMl: number;
};
export type FoodUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';
export type RecipeCourse =
  | 'breakfast'
  | 'starter'
  | 'main'
  | 'dinner'
  | 'salad'
  | 'dessert';
export type FoodItem = {
  id: number;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
  category: string;
  expiresOn: string | null;
  updatedAt: string;
  updatedByName: string;
};
export type RecipeIngredient = {
  id: number;
  recipeId: number;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
};
export type Recipe = {
  id: number;
  name: string;
  course: RecipeCourse;
  servings: number;
  instructions: string;
  createdAt: string;
  createdByName: string;
  ingredients: RecipeIngredient[];
};
export type WeeklyMeal = {
  id: number;
  weekStart: string;
  dayIndex: number;
  course: RecipeCourse;
  recipeId: number;
  servings: number;
};
export type AiMealPlanProposal = {
  summary: string;
  nutritionRationale: string;
  recipes: Array<{
    key: string;
    sourceRecipeId: number;
    name: string;
    course: RecipeCourse;
    description: string;
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: FoodUnit;
    }>;
    instructions: string;
  }>;
  schedule: Array<{
    dayIndex: number;
    course: RecipeCourse;
    recipeKey: string;
  }>;
};
export type AiPlanResult = {
  proposal: AiMealPlanProposal;
  model: string;
  nutritionContributors: number;
};
export type AiProgressStage =
  | 'starting'
  | 'preparing'
  | 'context'
  | 'requesting'
  | 'receiving'
  | 'validating';
export type AiStreamEvent =
  | {
      type: 'status';
      stage: AiProgressStage;
      provider?: string;
      model?: string;
    }
  | { type: 'delta'; delta: string }
  | { type: 'result'; result: AiPlanResult }
  | { type: 'error'; error: string; code?: ApiErrorCode; status?: number };
export type Data = {
  currentUser: AuthUser;
  members: Member[];
  home: HomeProfile;
  nutrition: Nutrition[];
  nutritionHistory: Nutrition[];
  nutritionHistoryCount: number;
  nutritionHistoryHasMore: boolean;
  nutritionHistoryDays: NutritionHistoryDay[];
  tasks: Task[];
  expenses: Expense[];
  expenseCount: number;
  expenseTotal: number;
  expensesHasMore: boolean;
  recurringPayments: RecurringPayment[];
  spendingBudgets: SpendingBudget[];
  organisers: Organiser[];
  reminders: Reminder[];
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationDoseHistory: MedicationDose[];
  medicationDoseHistoryCount: number;
  medicationDoseHistoryHasMore: boolean;
  medicationAdherenceDoses: MedicationAdherenceDose[];
  purchaseIdeas: PurchaseIdea[];
  purchaseVotes: PurchaseVote[];
  messages: Message[];
  messageCount: number;
  messagesHasMore: boolean;
  unreadMessages: number;
  notificationPreferences: NotificationPreferences;
  notificationStates: NotificationState[];
  habits: HabitEntry[];
  habitHistoryCount: number;
  habitHistoryHasMore: boolean;
  habitHistoryDays: HabitHistoryDay[];
  water: WaterEntry[];
  waterHistoryCount: number;
  waterHistoryHasMore: boolean;
  waterHistoryDays: WaterHistoryDay[];
  foods: FoodItem[];
  recipes: Recipe[];
  weeklyPlan: WeeklyMeal[];
  aiConfigured: boolean;
  aiConsentingMembers: number;
};
export type Post = (
  payload: Record<string, unknown>,
  options?: { quiet?: boolean },
) => Promise<boolean>;
export type T = (
  key: CopyKey,
  variables?: Record<string, string | number>,
) => string;
