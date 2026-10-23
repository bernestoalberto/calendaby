// Tests run signed out and never call Clerk, even when .env.local holds a real key.
delete process.env.CLERK_SECRET_KEY
