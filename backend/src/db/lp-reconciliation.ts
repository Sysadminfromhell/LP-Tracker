import { db } from './client';

export interface LpReconciliationQueueItem {
  eventParticipantId: number;
  attemptCount: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface LpRankObservation {
  id: number;
  eventParticipantId: number;
  rankScore: number;
  observedAt: string;
}
export interface LpReconciliationMatch {
  id: number;
  providerMatchId: string;
  gameCreatedAt: string;
  durationSeconds: number | null;
  result: 'WIN' | 'LOSE';
  lpDeltaStatus: 'pending' | 'unknown';
}
export interface LpReconciliationContext {
  eventParticipantId: number;
  eventId: number;
  eventStatus: 'draft' | 'scheduled' | 'active' | 'ended';
  playerId: number;
  gameName: string;
  tagLine: string;
  region: string;
  startRankScore: number;
  leftRankScore: number;
  rightRankScore: number | null;
  rightBoundaryAt: string | null;
  unresolvedBlockSynchronized: boolean;
  rankObservations: LpRankObservation[];
  unresolvedMatches: LpReconciliationMatch[];
}
export interface LpReconciliationResolution {
  providerMatchId: string;
  lpDelta: number;
  rankScoreAfter: number;
}
export interface ApplyLpReconciliationRequest {
  eventParticipantId: number;
  attemptCount: number;
  expectedLeftRankScore: number;
  expectedRightRankScore: number | null;
  expectedRightBoundaryAt: string | null;
  resolutions: LpReconciliationResolution[];
}
export interface ApplyLpReconciliationResult {
  applied: boolean;
  resolvedMatches: number;
  remainingUnresolved: boolean;
  reason: string | null;
}
interface ReconciliationApplyParticipantRow {
  start_rank_score: number;
  end_rank_score: number | null;
  event_status: 'draft' | 'scheduled' | 'active' | 'ended';
  event_ends_at: Date | null;
}
interface ReconciliationApplyMatchRow {
  id: string;
  provider_match_id: string;
  game_created_at: Date;
  result: 'WIN' | 'LOSE';
  lp_delta: number | null;
  rank_score_after: number | null;
  lp_delta_status: 'pending' | 'resolved' | 'unknown';
  is_sync_anchor: boolean;
}
interface ReconciliationApplyClaimRow {
  attempt_count: number;
  lease_active: boolean;
}
interface LpRankObservationRow {
  id: string;
  event_participant_id: string;
  rank_score: number;
  observed_at: Date;
}
interface LpReconciliationQueueRow {
  event_participant_id: string;
  attempt_count: number;
  next_attempt_at: Date;
  last_attempt_at: Date | null;
  last_error: string | null;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}
interface ReconciliationParticipantRow {
  event_participant_id: string;
  event_id: string;
  event_status: 'draft' | 'scheduled' | 'active' | 'ended';
  event_ends_at: Date | null;
  player_id: string;
  game_name: string;
  tag_line: string;
  region: string;
  start_rank_score: number;
  end_rank_score: number | null;
}
interface ReconciliationMatchRow {
  id: string;
  provider_match_id: string;
  game_created_at: Date;
  duration_seconds: number | null;
  result: 'WIN' | 'LOSE';
  lp_delta_status: 'pending' | 'unknown';
}
interface ReconciliationAnchorRow {
  id: string;
  game_created_at: Date;
  lp_delta: number | null;
  rank_score_after: number | null;
}

function mapQueueItem(row: LpReconciliationQueueRow): LpReconciliationQueueItem {
  return {
    eventParticipantId: Number(row.event_participant_id),
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at.toISOString(),
    lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
    lastError: row.last_error,
    lockedUntil: row.locked_until?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export async function enqueueLpReconciliation(eventParticipantId: number): Promise<void> {
  await db.query(
    `
      INSERT INTO lp_reconciliation_queue (
        event_participant_id,
        next_attempt_at
      )
      VALUES (
        $1,
        NOW()
      )

      ON CONFLICT (event_participant_id)
      DO NOTHING
      `,
    [eventParticipantId],
  );
}
export async function claimLpReconciliationJobs(
  limit = 5,
  leaseSeconds = 120,
): Promise<LpReconciliationQueueItem[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const safeLeaseSeconds = Math.max(30, Math.min(900, Math.floor(leaseSeconds)));
  const result = await db.query<LpReconciliationQueueRow>(
    `
      WITH due_jobs AS (
        SELECT
          event_participant_id
        FROM lp_reconciliation_queue
        WHERE
          next_attempt_at <= NOW()
          AND (
            locked_until IS NULL
            OR locked_until <= NOW()
          )
        ORDER BY
          next_attempt_at ASC,
          event_participant_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )

      UPDATE lp_reconciliation_queue queue
      SET
        attempt_count = queue.attempt_count + 1,
        last_attempt_at = NOW(),
        locked_until = NOW() + ($2 * INTERVAL '1 second'),
        updated_at = NOW()
      FROM due_jobs
      WHERE
        queue.event_participant_id = due_jobs.event_participant_id
      RETURNING
        queue.event_participant_id,
        queue.attempt_count,
        queue.next_attempt_at,
        queue.last_attempt_at,
        queue.last_error,
        queue.locked_until,
        queue.created_at,
        queue.updated_at
      `,
    [safeLimit, safeLeaseSeconds],
  );
  return result.rows.map(mapQueueItem);
}
export async function completeLpReconciliation(eventParticipantId: number): Promise<void> {
  await db.query(
    `
      DELETE FROM lp_reconciliation_queue
      WHERE event_participant_id = $1
      `,
    [eventParticipantId],
  );
}
export async function completeClaimedLpReconciliation(
  eventParticipantId: number,
  attemptCount: number,
): Promise<boolean> {
  const result = await db.query(
    `
      DELETE FROM lp_reconciliation_queue queue
      WHERE
        queue.event_participant_id = $1
        AND queue.attempt_count = $2
        AND NOT EXISTS (
          SELECT 1
          FROM event_matches match
          WHERE
            match.event_participant_id = queue.event_participant_id
            AND match.lp_delta_status IN (
              'pending',
              'unknown'
            )
        )
    `,
    [eventParticipantId, attemptCount],
  );
  return result.rowCount === 1;
}
export async function retryLpReconciliation(
  eventParticipantId: number,
  delaySeconds: number,
  error: string | null,
): Promise<void> {
  const safeDelaySeconds = Math.max(30, Math.min(86_400, Math.floor(delaySeconds)));
  await db.query(
    `
      UPDATE lp_reconciliation_queue
      SET
        next_attempt_at = NOW() + ($2 * INTERVAL '1 second'),
        last_error = $3,
        locked_until = NULL,
        updated_at = NOW()
      WHERE event_participant_id = $1
      `,
    [eventParticipantId, safeDelaySeconds, error],
  );
}
export async function retryClaimedLpReconciliation(
  eventParticipantId: number,
  attemptCount: number,
  delaySeconds: number,
  error: string | null,
): Promise<boolean> {
  const safeDelaySeconds = Math.max(30, Math.min(86_400, Math.floor(delaySeconds)));
  const result = await db.query(
    `
      UPDATE lp_reconciliation_queue queue
      SET
        next_attempt_at = CASE
          WHEN EXISTS (
            SELECT 1
            FROM lp_rank_observations observation
            WHERE
              observation.event_participant_id = queue.event_participant_id
              AND observation.created_at > queue.last_attempt_at
          )
          THEN NOW()
          ELSE NOW() + ($3 * INTERVAL '1 second')
        END,
        last_error = $4,
        locked_until = NULL,
        updated_at = NOW()
      WHERE
        queue.event_participant_id = $1
        AND queue.attempt_count = $2
    `,
    [eventParticipantId, attemptCount, safeDelaySeconds, error],
  );
  return result.rowCount === 1;
}
export async function releaseLpReconciliation(eventParticipantId: number): Promise<void> {
  await db.query(
    `
      UPDATE lp_reconciliation_queue
      SET
        locked_until = NULL,
        updated_at = NOW()
      WHERE event_participant_id = $1
      `,
    [eventParticipantId],
  );
}
export async function releaseClaimedLpReconciliation(
  eventParticipantId: number,
  attemptCount: number,
): Promise<boolean> {
  const result = await db.query(
    `
      UPDATE lp_reconciliation_queue
      SET
        locked_until = NULL,
        updated_at = NOW()
      WHERE
        event_participant_id = $1
        AND attempt_count = $2
    `,
    [eventParticipantId, attemptCount],
  );
  return result.rowCount === 1;
}
export async function getLpReconciliationContext(
  eventParticipantId: number,
): Promise<LpReconciliationContext | null> {
  const participantResult = await db.query<ReconciliationParticipantRow>(
    `
      SELECT
        ep.id AS event_participant_id,
        ep.event_id,
        e.status AS event_status,
        e.ends_at AS event_ends_at,

        p.id AS player_id,
        p.game_name,
        p.tag_line,
        p.region,

        ep.start_rank_score,
        ep.end_rank_score

      FROM event_participants ep

      JOIN events e
        ON e.id = ep.event_id

      JOIN players p
        ON p.id = ep.player_id

      WHERE ep.id = $1

      LIMIT 1
    `,
    [eventParticipantId],
  );
  const participant = participantResult.rows[0];
  if (!participant) {
    return null;
  }
  const firstUnresolvedResult = await db.query<ReconciliationMatchRow>(
    `
      SELECT
        em.id,
        em.provider_match_id,
        em.game_created_at,
        em.duration_seconds,
        em.result,
        em.lp_delta_status

      FROM event_matches em

      WHERE
        event_participant_id = $1
        AND lp_delta_status IN (
          'pending',
          'unknown'
        )

      ORDER BY
        game_created_at ASC,
        id ASC

      LIMIT 1
    `,
    [eventParticipantId],
  );
  const firstUnresolved = firstUnresolvedResult.rows[0];
  if (!firstUnresolved) {
    return {
      eventParticipantId: Number(participant.event_participant_id),
      eventId: Number(participant.event_id),
      eventStatus: participant.event_status,
      playerId: Number(participant.player_id),
      gameName: participant.game_name,
      tagLine: participant.tag_line,
      region: participant.region,
      startRankScore: participant.start_rank_score,
      leftRankScore: participant.start_rank_score,
      rightBoundaryAt: null,
      rightRankScore: null,
      unresolvedBlockSynchronized: true,
      rankObservations: [],
      unresolvedMatches: [],
    };
  }
  const leftAnchorResult = await db.query<{
    rank_score_after: number;
  }>(
    `
      SELECT
        rank_score_after

      FROM event_matches

      WHERE
        event_participant_id = $1
        AND (
          game_created_at,
          id
        ) < (
          $2,
          $3
        )
        AND lp_delta_status = 'resolved'
        AND rank_score_after IS NOT NULL

      ORDER BY
        game_created_at DESC,
        id DESC

      LIMIT 1
    `,
    [eventParticipantId, firstUnresolved.game_created_at, firstUnresolved.id],
  );
  const leftRankScore = leftAnchorResult.rows[0]?.rank_score_after ?? participant.start_rank_score;
  const rightBoundaryResult = await db.query<ReconciliationAnchorRow>(
    `
      SELECT
        id,
        game_created_at,
        lp_delta,
        rank_score_after

      FROM event_matches

      WHERE
        event_participant_id = $1
        AND (
          game_created_at,
          id
        ) > (
          $2,
          $3
        )
        AND lp_delta_status = 'resolved'

      ORDER BY
        game_created_at ASC,
        id ASC

      LIMIT 1
    `,
    [eventParticipantId, firstUnresolved.game_created_at, firstUnresolved.id],
  );
  const rightBoundary = rightBoundaryResult.rows[0] ?? null;
  let rightRankScore: number | null = null;
  let rightBoundaryAt: string | null = null;
  if (
    rightBoundary?.rank_score_after !== null &&
    rightBoundary?.rank_score_after !== undefined &&
    rightBoundary.lp_delta !== null
  ) {
    rightRankScore = rightBoundary.rank_score_after - rightBoundary.lp_delta;
    rightBoundaryAt = rightBoundary.game_created_at.toISOString();
  } else if (
    rightBoundary === null &&
    participant.event_status === 'ended' &&
    participant.end_rank_score !== null
  ) {
    rightRankScore = participant.end_rank_score;
    rightBoundaryAt = participant.event_ends_at?.toISOString() ?? null;
  }
  let unresolvedResult;
  if (rightBoundary) {
    unresolvedResult = await db.query<ReconciliationMatchRow>(
      `
        SELECT
          em.id,
          em.provider_match_id,
          em.game_created_at,
          em.duration_seconds,
          em.result,
          em.lp_delta_status

        FROM event_matches em

        WHERE
          event_participant_id = $1
          AND lp_delta_status IN (
            'pending',
            'unknown'
          )
          AND (
            game_created_at,
            id
          ) >= (
            $2,
            $3
          )
          AND (
            game_created_at,
            id
          ) < (
            $4,
            $5
          )

        ORDER BY
          game_created_at ASC,
          id ASC
      `,
      [
        eventParticipantId,
        firstUnresolved.game_created_at,
        firstUnresolved.id,
        rightBoundary.game_created_at,
        rightBoundary.id,
      ],
    );
  } else {
    unresolvedResult = await db.query<ReconciliationMatchRow>(
      `
        SELECT
          em.id,
          em.provider_match_id,
          em.game_created_at,
          em.duration_seconds,
          em.result,
          em.lp_delta_status

        FROM event_matches em

        WHERE
          event_participant_id = $1
          AND lp_delta_status IN (
            'pending',
            'unknown'
          )
          AND (
            game_created_at,
            id
          ) >= (
            $2,
            $3
          )

        ORDER BY
          game_created_at ASC,
          id ASC
      `,
      [eventParticipantId, firstUnresolved.game_created_at, firstUnresolved.id],
    );
  }
  const rankObservations = await getLpRankObservations(eventParticipantId);
  const lastUnresolved = unresolvedResult.rows.at(-1);
  let unresolvedBlockSynchronized = false;
  if (lastUnresolved) {
    const syncResult = await db.query<{ synchronized: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM event_matches
        WHERE
          event_participant_id = $1
          AND is_sync_anchor = TRUE
          AND (
            game_created_at,
            id
          ) >= (
            $2,
            $3
          )
      ) AS synchronized
    `,
      [eventParticipantId, lastUnresolved.game_created_at, lastUnresolved.id],
    );
    unresolvedBlockSynchronized = syncResult.rows[0]?.synchronized ?? false;
  }
  return {
    eventParticipantId: Number(participant.event_participant_id),
    eventId: Number(participant.event_id),
    eventStatus: participant.event_status,
    playerId: Number(participant.player_id),
    gameName: participant.game_name,
    tagLine: participant.tag_line,
    region: participant.region,
    startRankScore: participant.start_rank_score,
    leftRankScore,
    rightRankScore,
    rightBoundaryAt,
    unresolvedBlockSynchronized,
    rankObservations,
    unresolvedMatches: unresolvedResult.rows.map((match) => ({
      id: Number(match.id),
      providerMatchId: match.provider_match_id,
      gameCreatedAt: match.game_created_at.toISOString(),
      durationSeconds: match.duration_seconds,
      result: match.result,
      lpDeltaStatus: match.lp_delta_status,
    })),
  };
}
export async function applyLpReconciliationResolutions(
  request: ApplyLpReconciliationRequest,
): Promise<ApplyLpReconciliationResult> {
  const {
    eventParticipantId,
    attemptCount,
    expectedLeftRankScore,
    expectedRightRankScore,
    expectedRightBoundaryAt,
    resolutions,
  } = request;
  if (resolutions.length === 0) {
    return {
      applied: false,
      resolvedMatches: 0,
      remainingUnresolved: true,
      reason: 'No LP resolutions supplied',
    };
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const participantResult = await client.query<ReconciliationApplyParticipantRow>(
      `
          SELECT
            ep.start_rank_score,
            ep.end_rank_score,
            e.status AS event_status,
            e.ends_at AS event_ends_at

          FROM event_participants ep

          JOIN events e
            ON e.id = ep.event_id

          WHERE ep.id = $1

          FOR UPDATE OF ep
        `,
      [eventParticipantId],
    );
    const participant = participantResult.rows[0];
    if (!participant) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: false,
        reason: `Event participant ${eventParticipantId} ` + `no longer exists`,
      };
    }
    const matchesResult = await client.query<ReconciliationApplyMatchRow>(
      `
          SELECT
            id,
            provider_match_id,
            game_created_at,
            result,
            lp_delta,
            rank_score_after,
            lp_delta_status,
            is_sync_anchor

          FROM event_matches

          WHERE event_participant_id = $1

          ORDER BY
            game_created_at ASC,
            id ASC

          FOR UPDATE
        `,
      [eventParticipantId],
    );
    const matches = matchesResult.rows;
    const firstUnresolvedIndex = matches.findIndex(
      (match) => match.lp_delta_status === 'pending' || match.lp_delta_status === 'unknown',
    );
    if (firstUnresolvedIndex === -1) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: false,
        reason: null,
      };
    }
    const claimResult = await client.query<ReconciliationApplyClaimRow>(
      `
          SELECT
            attempt_count,
            (
              locked_until IS NOT NULL
              AND locked_until > NOW()
            ) AS lease_active

          FROM lp_reconciliation_queue

          WHERE event_participant_id = $1

          FOR UPDATE
        `,
      [eventParticipantId],
    );
    const claim = claimResult.rows[0];
    if (!claim || claim.attempt_count !== attemptCount || !claim.lease_active) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: true,
        reason: 'LP reconciliation claim is no longer active',
      };
    }
    let blockEndIndex = firstUnresolvedIndex;
    while (
      blockEndIndex < matches.length &&
      (matches[blockEndIndex].lp_delta_status === 'pending' ||
        matches[blockEndIndex].lp_delta_status === 'unknown')
    ) {
      blockEndIndex++;
    }
    const unresolvedBlock = matches.slice(firstUnresolvedIndex, blockEndIndex);
    const unresolvedBlockSynchronized = matches.some(
      (match, index) => match.is_sync_anchor && index >= blockEndIndex - 1,
    );
    if (!unresolvedBlockSynchronized) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: true,
        reason: 'Unresolved block is not fully synchronized',
      };
    }
    if (resolutions.length > unresolvedBlock.length) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: true,
        reason:
          `Unresolved block contains only ` +
          `${unresolvedBlock.length} match(es), but ` +
          `${resolutions.length} resolutions were supplied`,
      };
    }
    let actualLeftRankScore = participant.start_rank_score;
    for (let index = firstUnresolvedIndex - 1; index >= 0; index--) {
      const match = matches[index];
      if (match.lp_delta_status === 'resolved' && match.rank_score_after !== null) {
        actualLeftRankScore = match.rank_score_after;
        break;
      }
    }
    if (actualLeftRankScore !== expectedLeftRankScore) {
      await client.query('COMMIT');
      return {
        applied: false,
        resolvedMatches: 0,
        remainingUnresolved: true,
        reason:
          `Left rank anchor changed from ` + `${expectedLeftRankScore} to ${actualLeftRankScore}`,
      };
    }
    const targetMatches = unresolvedBlock.slice(0, resolutions.length);
    for (let index = 0; index < targetMatches.length; index++) {
      if (targetMatches[index].provider_match_id !== resolutions[index].providerMatchId) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: 'LP resolutions no longer match the earliest ' + 'unresolved prefix',
        };
      }
    }
    let calculatedRankScore = actualLeftRankScore;
    for (let index = 0; index < resolutions.length; index++) {
      const resolution = resolutions[index];
      const match = targetMatches[index];
      if (!Number.isInteger(resolution.lpDelta) || !Number.isInteger(resolution.rankScoreAfter)) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: `Invalid LP resolution for match ` + `${resolution.providerMatchId}`,
        };
      }
      const directionValid =
        (match.result === 'WIN' && resolution.lpDelta > 0) ||
        (match.result === 'LOSE' && resolution.lpDelta < 0);
      if (!directionValid) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: `LP direction does not match result for match ` + `${resolution.providerMatchId}`,
        };
      }
      calculatedRankScore += resolution.lpDelta;
      if (calculatedRankScore !== resolution.rankScoreAfter) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: `Invalid LP chain for match ` + `${resolution.providerMatchId}`,
        };
      }
    }
    const resolvesEntireBlock = resolutions.length === unresolvedBlock.length;
    const rightBoundary = blockEndIndex < matches.length ? matches[blockEndIndex] : null;
    let actualRightRankScore: number | null = null;
    let actualRightBoundaryAt: string | null = null;
    if (
      rightBoundary?.lp_delta_status === 'resolved' &&
      rightBoundary.rank_score_after !== null &&
      rightBoundary.lp_delta !== null
    ) {
      actualRightRankScore = rightBoundary.rank_score_after - rightBoundary.lp_delta;
      actualRightBoundaryAt = rightBoundary.game_created_at.toISOString();
    } else if (
      rightBoundary === null &&
      participant.event_status === 'ended' &&
      participant.end_rank_score !== null
    ) {
      actualRightRankScore = participant.end_rank_score;
      actualRightBoundaryAt = participant.event_ends_at?.toISOString() ?? null;
    }
    if (resolvesEntireBlock) {
      if (expectedRightRankScore === null || expectedRightBoundaryAt === null) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: 'Complete unresolved block requires a stable ' + 'right rank anchor',
        };
      }
      if (
        actualRightRankScore !== expectedRightRankScore ||
        actualRightBoundaryAt !== expectedRightBoundaryAt
      ) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason: 'Right rank anchor changed during reconciliation',
        };
      }
      if (calculatedRankScore !== actualRightRankScore) {
        await client.query('COMMIT');
        return {
          applied: false,
          resolvedMatches: 0,
          remainingUnresolved: true,
          reason:
            `Resolved LP chain ended at ` +
            `${calculatedRankScore}, expected ` +
            `${actualRightRankScore}`,
        };
      }
    }
    for (let index = 0; index < targetMatches.length; index++) {
      const match = targetMatches[index];
      const resolution = resolutions[index];
      const updateResult = await client.query(
        `
          UPDATE event_matches

          SET
            lp_delta = $2,
            rank_score_after = $3,
            lp_delta_status = 'resolved',
            updated_at = NOW()

          WHERE
            id = $1
            AND event_participant_id = $4
            AND lp_delta_status IN (
              'pending',
              'unknown'
            )
        `,
        [match.id, resolution.lpDelta, resolution.rankScoreAfter, eventParticipantId],
      );
      if (updateResult.rowCount !== 1) {
        throw new Error(`Could not apply LP reconciliation for match ` + `${match.id}`);
      }
    }
    if (rightBoundary === null) {
      await client.query(
        `
          UPDATE event_participants

          SET
            last_resolved_rank_score = $2,
            updated_at = NOW()

          WHERE id = $1
        `,
        [eventParticipantId, calculatedRankScore],
      );
    }
    const remainingResult = await client.query<{
      has_unresolved: boolean;
    }>(
      `
        SELECT EXISTS (
          SELECT 1

          FROM event_matches

          WHERE
            event_participant_id = $1
            AND lp_delta_status IN (
              'pending',
              'unknown'
            )
        ) AS has_unresolved
      `,
      [eventParticipantId],
    );
    const remainingUnresolved = remainingResult.rows[0]?.has_unresolved ?? false;
    await client.query('COMMIT');
    return {
      applied: true,
      resolvedMatches: resolutions.length,
      remainingUnresolved,
      reason: null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function recordLpRankObservation(
  eventParticipantId: number,
  rankScore: number,
  observedAt = new Date(),
  force = false,
): Promise<boolean> {
  const result = await db.query<{ inserted: boolean }>(
    `
      WITH latest AS (
        SELECT rank_score
        FROM lp_rank_observations
        WHERE event_participant_id = $1
        ORDER BY observed_at DESC, id DESC
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO lp_rank_observations (
          event_participant_id,
          rank_score,
          observed_at
        )
        SELECT $1, $2, $3
        WHERE
          $4
          OR NOT EXISTS (
            SELECT 1
            FROM latest
            WHERE rank_score = $2
          )
        RETURNING id
      ),
        woken AS (
          UPDATE lp_reconciliation_queue
          SET
            next_attempt_at = NOW(),
            updated_at = NOW()
          WHERE
            event_participant_id = $1
            AND EXISTS (SELECT 1 FROM inserted)
          RETURNING event_participant_id
        )
      SELECT EXISTS (
        SELECT 1 FROM inserted
      ) AS inserted
    `,
    [eventParticipantId, rankScore, observedAt, force],
  );

  return result.rows[0]?.inserted ?? false;
}
export async function getLpRankObservations(
  eventParticipantId: number,
): Promise<LpRankObservation[]> {
  const result = await db.query<LpRankObservationRow>(
    `
      SELECT
        id,
        event_participant_id,
        rank_score,
        observed_at
      FROM lp_rank_observations
      WHERE event_participant_id = $1
      ORDER BY observed_at ASC, id ASC
    `,
    [eventParticipantId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    eventParticipantId: Number(row.event_participant_id),
    rankScore: row.rank_score,
    observedAt: row.observed_at.toISOString(),
  }));
}
