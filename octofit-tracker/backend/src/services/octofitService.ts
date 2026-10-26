import { isValidObjectId } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Activity data is required'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' || !isValidObjectId(userId) ||
    typeof teamId !== 'string' || !isValidObjectId(teamId) ||
    typeof type !== 'string' || !type.trim() ||
    typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0
  ) {
    throw Object.assign(new Error('Activity data is invalid'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: userId }),
    Team.exists({ _id: teamId }),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity user or team was not found'), { status: 404 });
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type,
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Team data is required'), { status: 400 });
  }

  const { name, mascot, members = [] } = input as Record<string, unknown>;
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof mascot !== 'string' || !mascot.trim() ||
    !Array.isArray(members) ||
    !members.every((member) => typeof member === 'string' && isValidObjectId(member))
  ) {
    throw Object.assign(new Error('Team data is invalid'), { status: 400 });
  }

  return Team.create({ name, mascot, members });
}

export async function getLeaderboard() {
  const teams = await Team.aggregate<{ teamName: string; totalPoints: number }>([
    {
      $lookup: {
        from: Activity.collection.name,
        localField: '_id',
        foreignField: 'team',
        as: 'activities',
      },
    },
    {
      $project: {
        _id: 0,
        teamName: '$name',
        totalPoints: { $sum: '$activities.points' },
      },
    },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User was not found'), { status: 404 });
  }

  const [recentActivities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(5).select('type').lean(),
    Workout.find().lean(),
  ]);

  const normalizedGoal = user.fitnessGoal.trim().toLowerCase();
  const activityFocusByType: Record<string, string> = {
    run: 'endurance',
    cycle: 'endurance',
    cycling: 'endurance',
    walk: 'endurance',
    swim: 'endurance',
    strength: 'strength',
    weights: 'strength',
    yoga: 'mobility',
    stretching: 'mobility',
  };

  const recommendations = workouts.map((workout) => {
    const focus = workout.focus.trim().toLowerCase();
    const matchedActivity = recentActivities
      .map((activity, index) => ({
        activity,
        index,
        focus: activityFocusByType[activity.type.trim().toLowerCase()] ?? activity.type.trim().toLowerCase(),
      }))
      .find(({ focus: activityFocus }) => activityFocus === focus);
    const matchesGoal = focus === normalizedGoal;
    const score = (matchesGoal ? 2 : 0) + (matchedActivity ? 1 / (matchedActivity.index + 1) : 0);
    const reasons = [];

    if (matchesGoal) reasons.push(`matches your ${user.fitnessGoal} goal`);
    if (matchedActivity) reasons.push(`aligns with your recent ${matchedActivity.activity.type} activity`);

    return {
      ...workout,
      reason: reasons.length
        ? `Recommended because it ${reasons.join(' and ')}.`
        : `Offers a complementary focus for your ${user.fitnessGoal} goal.`,
      score,
    };
  });

  recommendations.sort((first, second) =>
    second.score - first.score ||
    first.focus.localeCompare(second.focus) ||
    (first.title ?? '').localeCompare(second.title ?? ''),
  );

  return recommendations.map(({ score: _score, ...workout }) => workout);
}

export { User };
