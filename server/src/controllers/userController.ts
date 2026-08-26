import type { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { badRequest, notFound } from '../lib/httpError.js';

const IdentifyBody = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

/**
 * Identifies or registers a user by their name.
 *
 * If the name already exists in the database (case-insensitive),
 * it returns the existing user and flags `isNewUser: false`.
 * If it is a new name, it generates a clean `userId` (e.g. `usr_tony`),
 * persists the user in MongoDB, and flags `isNewUser: true`.
 */
export async function identifyUser(req: Request, res: Response): Promise<void> {
  const parsed = IdentifyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid request body', parsed.error.issues.map((i) => i.message));
  }

  const cleanName = parsed.data.name.trim();
  const normalized = cleanName.toLowerCase();

  let user = await User.findOne({ normalizedName: normalized });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
    let candidateId = `usr_${baseSlug}`;

    // Ensure generated userId is unique
    const existingWithId = await User.findOne({ userId: candidateId });
    if (existingWithId) {
      candidateId = `${candidateId}_${Math.random().toString(36).slice(2, 6)}`;
    }

    user = await User.create({
      userId: candidateId,
      name: cleanName,
      normalizedName: normalized,
    });
  }

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    isNewUser,
    user: {
      userId: user.userId,
      name: user.name,
      createdAt: user.createdAt,
    },
    message: isNewUser
      ? `Welcome, ${user.name}! Created your new profile.`
      : `Welcome back, ${user.name}! Loaded your architecture sessions.`,
  });
}

/**
 * Lists registered users, sorted by most recently active.
 */
export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await User.find().sort({ updatedAt: -1 }).limit(50);

  res.status(200).json({
    success: true,
    total: users.length,
    users: users.map((u) => ({
      userId: u.userId,
      name: u.name,
      createdAt: u.createdAt,
    })),
  });
}

/**
 * Retrieves a user profile by `userId`.
 */
export async function getUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params as { userId: string };
  const user = await User.findOne({ userId });

  if (!user) {
    throw notFound(`No user found with ID ${userId}`);
  }

  res.status(200).json({
    success: true,
    user: {
      userId: user.userId,
      name: user.name,
      createdAt: user.createdAt,
    },
  });
}
