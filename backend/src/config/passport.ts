import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { User, Team } from '../models';
import { JWTPayload } from '../types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Check if user exists with Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if user exists with email
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email provided by Google'), undefined);
        }

        user = await User.findOne({ email });

        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.authProvider = 'google';
          user.avatar = profile.photos?.[0]?.value;
          user.isEmailVerified = true;
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = await User.create({
          email,
          name: profile.displayName || 'User',
          googleId: profile.id,
          authProvider: 'google',
          avatar: profile.photos?.[0]?.value,
          isEmailVerified: true,
          preferences: {
            theme: 'light',
          },
        });

        // Auto-create personal workspace for new Google user
        await Team.create({
          name: `${user.name}'s Workspace`,
          description: 'Your personal workspace',
          owner: user._id,
          members: [
            {
              user: user._id,
              role: 'owner',
              joinedAt: new Date(),
            },
          ],
          projects: [],
          isPersonal: true,
        });

        done(null, user);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  )
);

// JWT Strategy
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
    },
    async (payload: JWTPayload, done) => {
      try {
        const user = await User.findById(payload.userId);

        if (!user) {
          return done(null, false);
        }

        done(null, user);
      } catch (error) {
        done(error, false);
      }
    }
  )
);

export default passport;

