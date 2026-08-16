import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface DailyCommerceMetric_Key {
  courseId: string;
  teeSheetId: string;
  date: DateString;
  department: string;
  __typename?: 'DailyCommerceMetric_Key';
}

export interface DailyGolfMetric_Key {
  courseId: string;
  teeSheetId: string;
  date: DateString;
  __typename?: 'DailyGolfMetric_Key';
}

export interface ForeupSyncRun_Key {
  id: UUIDString;
  __typename?: 'ForeupSyncRun_Key';
}

export interface ListDailyCommerceMetricsData {
  dailyCommerceMetrics: ({
    date: DateString;
    department: string;
    transactions: number;
    unitsSold: number;
    revenue: number;
    syncedAt: TimestampString;
  })[];
}

export interface ListDailyCommerceMetricsVariables {
  courseId: string;
  teeSheetId: string;
  start: DateString;
  end: DateString;
}

export interface ListDailyGolfMetricsData {
  dailyGolfMetrics: ({
    courseId: string;
    teeSheetId: string;
    date: DateString;
    bookings: number;
    occupancy: number;
    playersCheckedIn: number;
    playerNoShows: number;
    potentialSlots: number;
    slotsAvailable: number;
    revenue: number;
    memberRounds: number;
    memberBookings: number;
    memberCarts: number;
    memberGreenFeeRevenue: number;
    nonMemberRounds: number;
    nonMemberBookings: number;
    nonMemberCarts: number;
    nonMemberGreenFeeRevenue: number;
    unclassifiedRounds: number;
    sourceBookings: number;
    syncedAt: TimestampString;
  } & DailyGolfMetric_Key)[];
}

export interface ListDailyGolfMetricsVariables {
  courseId: string;
  teeSheetId: string;
  start: DateString;
  end: DateString;
}

export interface StartForeupSyncRunData {
  foreupSyncRun_insert: ForeupSyncRun_Key;
}

export interface StartForeupSyncRunVariables {
  courseId: string;
  teeSheetId: string;
}

export interface UpsertDailyCommerceMetricData {
  dailyCommerceMetric_upsert: DailyCommerceMetric_Key;
}

export interface UpsertDailyCommerceMetricVariables {
  courseId: string;
  teeSheetId: string;
  date: DateString;
  department: string;
  transactions: number;
  unitsSold: number;
  revenue: number;
}

export interface UpsertDailyGolfMetricData {
  dailyGolfMetric_upsert: DailyGolfMetric_Key;
}

export interface UpsertDailyGolfMetricVariables {
  courseId: string;
  teeSheetId: string;
  date: DateString;
  bookings: number;
  occupancy: number;
  playersCheckedIn: number;
  playerNoShows: number;
  potentialSlots: number;
  slotsAvailable: number;
  revenue: number;
  memberRounds: number;
  memberBookings: number;
  memberCarts: number;
  memberGreenFeeRevenue: number;
  nonMemberRounds: number;
  nonMemberBookings: number;
  nonMemberCarts: number;
  nonMemberGreenFeeRevenue: number;
  unclassifiedRounds: number;
  sourceBookings: number;
}

/** Generated Node Admin SDK operation action function for the 'UpsertDailyGolfMetric' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertDailyGolfMetric(dc: DataConnect, vars: UpsertDailyGolfMetricVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertDailyGolfMetricData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertDailyGolfMetric' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertDailyGolfMetric(vars: UpsertDailyGolfMetricVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertDailyGolfMetricData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertDailyCommerceMetric' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertDailyCommerceMetric(dc: DataConnect, vars: UpsertDailyCommerceMetricVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertDailyCommerceMetricData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertDailyCommerceMetric' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertDailyCommerceMetric(vars: UpsertDailyCommerceMetricVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertDailyCommerceMetricData>>;

/** Generated Node Admin SDK operation action function for the 'StartForeupSyncRun' Mutation. Allow users to execute without passing in DataConnect. */
export function startForeupSyncRun(dc: DataConnect, vars: StartForeupSyncRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartForeupSyncRunData>>;
/** Generated Node Admin SDK operation action function for the 'StartForeupSyncRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function startForeupSyncRun(vars: StartForeupSyncRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartForeupSyncRunData>>;

/** Generated Node Admin SDK operation action function for the 'ListDailyGolfMetrics' Query. Allow users to execute without passing in DataConnect. */
export function listDailyGolfMetrics(dc: DataConnect, vars: ListDailyGolfMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyGolfMetricsData>>;
/** Generated Node Admin SDK operation action function for the 'ListDailyGolfMetrics' Query. Allow users to pass in custom DataConnect instances. */
export function listDailyGolfMetrics(vars: ListDailyGolfMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyGolfMetricsData>>;

/** Generated Node Admin SDK operation action function for the 'ListDailyCommerceMetrics' Query. Allow users to execute without passing in DataConnect. */
export function listDailyCommerceMetrics(dc: DataConnect, vars: ListDailyCommerceMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyCommerceMetricsData>>;
/** Generated Node Admin SDK operation action function for the 'ListDailyCommerceMetrics' Query. Allow users to pass in custom DataConnect instances. */
export function listDailyCommerceMetrics(vars: ListDailyCommerceMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyCommerceMetricsData>>;

