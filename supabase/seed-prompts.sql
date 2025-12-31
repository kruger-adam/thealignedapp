-- Seed script for question_prompts table
-- Run this in Supabase SQL Editor after creating the table

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS question_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_question_prompts_category ON question_prompts(category);
CREATE INDEX IF NOT EXISTS idx_question_prompts_unused ON question_prompts(category, is_used) WHERE is_used = false;

-- Enable RLS
ALTER TABLE question_prompts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view prompts" ON question_prompts;

-- Create policy
CREATE POLICY "Anyone can view prompts"
    ON question_prompts FOR SELECT
    USING (true);

-- Clear existing prompts (optional - remove this line if you want to keep existing prompts)
-- TRUNCATE question_prompts;

-- Insert prompts by category

-- 🤔 Hypothetical
INSERT INTO question_prompts (category, content) VALUES
('🤔 Hypothetical', 'Would you move to another country for your dream job?'),
('🤔 Hypothetical', 'Would you give up social media forever for $1 million?'),
('🤔 Hypothetical', 'Would you rather know the date of your death or the cause?'),
('🤔 Hypothetical', 'Would you take a one-way trip to Mars?'),
('🤔 Hypothetical', 'Would you live in a simulation if it meant eternal happiness?'),
('🤔 Hypothetical', 'Would you choose to know everyone''s true thoughts about you?'),
('🤔 Hypothetical', 'Would you restart life from age 10 with all your current knowledge?'),
('🤔 Hypothetical', 'Would you accept immortality if it meant outliving everyone you love?');

-- 💭 Ethics
INSERT INTO question_prompts (category, content) VALUES
('💭 Ethics', 'Is it ever okay to lie to protect someone?'),
('💭 Ethics', 'Should billionaires be taxed more heavily?'),
('💭 Ethics', 'Is it ethical to eat meat?'),
('💭 Ethics', 'Should AI be allowed to make life-or-death decisions?'),
('💭 Ethics', 'Is privacy more important than security?'),
('💭 Ethics', 'Is it wrong to ghost someone instead of rejecting them directly?'),
('💭 Ethics', 'Should parents be allowed to genetically modify their children?'),
('💭 Ethics', 'Is it okay to pirate content from billion-dollar companies?');

-- ❤️ Relationships
INSERT INTO question_prompts (category, content) VALUES
('❤️ Relationships', 'Is it okay to stay friends with an ex?'),
('❤️ Relationships', 'Should couples share passwords?'),
('❤️ Relationships', 'Is long-distance worth it?'),
('❤️ Relationships', 'Should you tell a friend if their partner is cheating?'),
('❤️ Relationships', 'Is it better to marry your best friend or someone you have chemistry with?'),
('❤️ Relationships', 'Is it a red flag if someone has no close friends?'),
('❤️ Relationships', 'Should you split the bill on a first date?'),
('❤️ Relationships', 'Is it okay to go through your partner''s phone if you suspect something?');

-- 💼 Work & Career
INSERT INTO question_prompts (category, content) VALUES
('💼 Work & Career', 'Is work-life balance actually achievable?'),
('💼 Work & Career', 'Should you follow your passion or the money?'),
('💼 Work & Career', 'Is college worth it anymore?'),
('💼 Work & Career', 'Would you take a 50% pay cut for a job you love?'),
('💼 Work & Career', 'Is it better to rent or buy a home?'),
('💼 Work & Career', 'Should you ever accept a counteroffer from your current employer?'),
('💼 Work & Career', 'Is remote work better than office work?'),
('💼 Work & Career', 'Should you stay at a job you hate for financial security?');

-- 🎮 Fun & Silly
INSERT INTO question_prompts (category, content) VALUES
('🎮 Fun & Silly', 'Is a hot dog a sandwich?'),
('🎮 Fun & Silly', 'Should pineapple go on pizza?'),
('🎮 Fun & Silly', 'Is water wet?'),
('🎮 Fun & Silly', 'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?'),
('🎮 Fun & Silly', 'Is cereal a soup?'),
('🎮 Fun & Silly', 'Does the person who sleeps closest to the door have to fight the intruder?'),
('🎮 Fun & Silly', 'Is a Pop-Tart a ravioli?'),
('🎮 Fun & Silly', 'Would you eat a bug for $100?');

-- 🗳️ Society
INSERT INTO question_prompts (category, content) VALUES
('🗳️ Society', 'Should voting be mandatory?'),
('🗳️ Society', 'Is democracy the best form of government?'),
('🗳️ Society', 'Should there be term limits for all politicians?'),
('🗳️ Society', 'Is political correctness helping or hurting society?'),
('🗳️ Society', 'Should the voting age be lowered to 16?'),
('🗳️ Society', 'Should billionaires exist?'),
('🗳️ Society', 'Is cancel culture a net positive for society?'),
('🗳️ Society', 'Should there be limits on free speech?');

-- 🧠 Technology
INSERT INTO question_prompts (category, content) VALUES
('🧠 Technology', 'Will AI take most jobs within 20 years?'),
('🧠 Technology', 'Should social media have age verification?'),
('🧠 Technology', 'Is it ethical to date someone you met through AI matchmaking?'),
('🧠 Technology', 'Should we colonize Mars before fixing Earth?'),
('🧠 Technology', 'Would you get a brain chip implant for enhanced memory?'),
('🧠 Technology', 'Should autonomous weapons be banned?'),
('🧠 Technology', 'Is it okay to use AI to write work emails?'),
('🧠 Technology', 'Should there be a universal right to internet access?');

-- 🏃 Health & Wellness
INSERT INTO question_prompts (category, content) VALUES
('🏃 Health & Wellness', 'Is it okay to lie about your fitness routine?'),
('🏃 Health & Wellness', 'Should junk food be taxed like cigarettes?'),
('🏃 Health & Wellness', 'Is 8 hours of sleep really necessary?'),
('🏃 Health & Wellness', 'Would you take a pill that makes you happy but slightly shortens your life?'),
('🏃 Health & Wellness', 'Is mental health day just as valid as a sick day?'),
('🏃 Health & Wellness', 'Should employers be required to provide gym memberships?'),
('🏃 Health & Wellness', 'Is it okay to judge people for their eating habits?'),
('🏃 Health & Wellness', 'Would you give up coffee forever for better sleep?');

-- 🎬 Entertainment
INSERT INTO question_prompts (category, content) VALUES
('🎬 Entertainment', 'Are remakes ever better than the original?'),
('🎬 Entertainment', 'Should movie theaters serve full meals?'),
('🎬 Entertainment', 'Is binge-watching unhealthy?'),
('🎬 Entertainment', 'Should artists separate their art from their personal behavior?'),
('🎬 Entertainment', 'Is reading books superior to watching movies?'),
('🎬 Entertainment', 'Should spoilers have a statute of limitations?'),
('🎬 Entertainment', 'Is vinyl actually better than digital music?'),
('🎬 Entertainment', 'Would you rather never watch new movies or never rewatch old favorites?');

-- 🌍 Environment
INSERT INTO question_prompts (category, content) VALUES
('🌍 Environment', 'Should single-use plastics be completely banned?'),
('🌍 Environment', 'Would you give up meat to save the environment?'),
('🌍 Environment', 'Is nuclear power the solution to climate change?'),
('🌍 Environment', 'Should companies be legally required to offset their carbon footprint?'),
('🌍 Environment', 'Would you pay 20% more for all products if they were sustainable?'),
('🌍 Environment', 'Is individual action meaningless compared to corporate responsibility?'),
('🌍 Environment', 'Should flying be heavily taxed to reduce emissions?'),
('🌍 Environment', 'Would you live without air conditioning to reduce energy use?');

-- 🏛️ Politics
INSERT INTO question_prompts (category, content) VALUES
('🏛️ Politics', 'Should voting be mandatory?'),
('🏛️ Politics', 'Is democracy the best form of government?'),
('🏛️ Politics', 'Should there be term limits for all politicians?'),
('🏛️ Politics', 'Should the voting age be lowered to 16?'),
('🏛️ Politics', 'Is a two-party system fundamentally broken?'),
('🏛️ Politics', 'Should corporations be allowed to donate to political campaigns?'),
('🏛️ Politics', 'Is nationalism ever a good thing?'),
('🏛️ Politics', 'Should politicians be required to pass a competency test?');

-- Verify the insert
SELECT category, COUNT(*) as count FROM question_prompts GROUP BY category ORDER BY category;

