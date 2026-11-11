/// Daily motivation library shown when Anjali opens the app.
///
/// 100 hand-written messages themed on the universe, healing and positivity.
/// [MotivationService] picks one at random and avoids repeating any of the
/// last 30 shown, so the same message never appears twice in a month of use.
library;

/// A single motivation card: the message plus a theme used to pick its icon
/// and gradient in [MotivationDialog].
class MotivationMessage {
  const MotivationMessage(this.text, this.theme);

  final String text;
  final MotivationTheme theme;
}

/// Visual theme for a motivation card.
enum MotivationTheme { universe, healing, positivity }

/// The full library. Order is irrelevant; selection is random.
const List<MotivationMessage> kMotivationMessages = [
  // ── Universe (34) ─────────────────────────────────────────────────────────
  MotivationMessage('The universe is not working against you, Anjali. It is arranging every call, every lead and every "yes" in perfect timing.', MotivationTheme.universe),
  MotivationMessage('You are made of the same stardust that lights up galaxies. Shine that bright today.', MotivationTheme.universe),
  MotivationMessage('Every follow-up you make is a seed planted in the cosmos. Harvest season is coming.', MotivationTheme.universe),
  MotivationMessage('The stars do not compete with each other; they simply shine. Do your best and let the results find you.', MotivationTheme.universe),
  MotivationMessage('What is meant for you will never miss you. Today the universe is sending the right customers your way.', MotivationTheme.universe),
  MotivationMessage('Align your energy with abundance and watch your pipeline overflow.', MotivationTheme.universe),
  MotivationMessage('The moon does not rush to become full. Trust your pace; your growth is happening every day.', MotivationTheme.universe),
  MotivationMessage('You are exactly where the universe needs you to be, doing exactly what you are meant to do.', MotivationTheme.universe),
  MotivationMessage('Ask boldly, believe deeply, receive gracefully. The universe loves a clear intention.', MotivationTheme.universe),
  MotivationMessage('Every rejection is the universe redirecting you toward a better approval.', MotivationTheme.universe),
  MotivationMessage('Galaxies took billions of years to form. Your empire is being built one conversation at a time.', MotivationTheme.universe),
  MotivationMessage('Today, the universe whispers: "You are ready." Step forward with confidence.', MotivationTheme.universe),
  MotivationMessage('The same force that moves the oceans moves through you. Nothing is impossible today.', MotivationTheme.universe),
  MotivationMessage('Set your intention like a star sets its light: steady, warm and impossible to ignore.', MotivationTheme.universe),
  MotivationMessage('Synchronicities are signs you are on the right path. Notice them today and smile.', MotivationTheme.universe),
  MotivationMessage('You attract what you radiate. Radiate kindness, focus and success.', MotivationTheme.universe),
  MotivationMessage('The universe rewards action. One more call might be the one that changes everything.', MotivationTheme.universe),
  MotivationMessage('Look at the sky tonight and remember: something that vast believes in something as brilliant as you.', MotivationTheme.universe),
  MotivationMessage('Your dreams are not too big. The universe is bigger, and it has room for all of them.', MotivationTheme.universe),
  MotivationMessage('Abundance is your birthright. Open your hands and your heart to receive it today.', MotivationTheme.universe),
  MotivationMessage('Each sunrise is the universe giving you a fresh pipeline of possibilities.', MotivationTheme.universe),
  MotivationMessage('You are a magnet for opportunities, loyal clients and beautiful outcomes.', MotivationTheme.universe),
  MotivationMessage('The planets stay in orbit through quiet consistency. Your consistency is your superpower.', MotivationTheme.universe),
  MotivationMessage('Trust the timing of your life. Delays are not denials; they are divine preparation.', MotivationTheme.universe),
  MotivationMessage('Today, let your voice carry the calm confidence of someone the universe is supporting.', MotivationTheme.universe),
  MotivationMessage('Energy flows where attention goes. Focus on the leads that light you up.', MotivationTheme.universe),
  MotivationMessage('The universe heard every quiet prayer you made. Answers are on their way.', MotivationTheme.universe),
  MotivationMessage('Like the peacock feather, your beauty unfolds when you are calm and fearless.', MotivationTheme.universe),
  MotivationMessage('Your path is written in light. Walk it with gratitude and grace.', MotivationTheme.universe),
  MotivationMessage('There is a constellation of customers waiting to meet someone exactly like you.', MotivationTheme.universe),
  MotivationMessage('Small steps under the stars become giant leaps in the morning.', MotivationTheme.universe),
  MotivationMessage('You are a co-creator with the universe. Today, create something wonderful.', MotivationTheme.universe),
  MotivationMessage('When you vibrate with joy, success has no choice but to tune in.', MotivationTheme.universe),
  MotivationMessage('Infinite possibilities are available right now. Pick the one that makes your heart sing.', MotivationTheme.universe),

  // ── Healing (33) ──────────────────────────────────────────────────────────
  MotivationMessage('Breathe in peace, breathe out pressure. You are allowed to succeed gently.', MotivationTheme.healing),
  MotivationMessage('Healing is not linear and neither is sales. Every step forward counts.', MotivationTheme.healing),
  MotivationMessage('You do not have to carry every target on your shoulders. Do your part and release the rest.', MotivationTheme.healing),
  MotivationMessage('Be as patient with yourself as you are with your customers.', MotivationTheme.healing),
  MotivationMessage('Rest is productive. A calm mind closes more deals than a tired one.', MotivationTheme.healing),
  MotivationMessage('Let go of yesterday\'s "no". Today\'s heart is fresh, open and ready.', MotivationTheme.healing),
  MotivationMessage('Drink some water, roll your shoulders, smile. Your body is your most important tool.', MotivationTheme.healing),
  MotivationMessage('You are healing even on the days you feel stuck. Growth is happening beneath the surface.', MotivationTheme.healing),
  MotivationMessage('Forgive the call that went wrong. You learned something beautiful from it.', MotivationTheme.healing),
  MotivationMessage('Your worth is not measured by today\'s numbers. You are valuable, always.', MotivationTheme.healing),
  MotivationMessage('Like a lotus rising from still water, you rise beautifully from every challenge.', MotivationTheme.healing),
  MotivationMessage('Soft heart, strong spirit. That combination is unstoppable.', MotivationTheme.healing),
  MotivationMessage('Release the need to control every outcome. Trust, act and allow.', MotivationTheme.healing),
  MotivationMessage('Take three deep breaths before your first call. Peace is contagious.', MotivationTheme.healing),
  MotivationMessage('You are allowed to outgrow old doubts. Leave them behind today.', MotivationTheme.healing),
  MotivationMessage('Kindness to yourself is the foundation of every success story.', MotivationTheme.healing),
  MotivationMessage('Every wound becomes wisdom. Every setback becomes a story of strength.', MotivationTheme.healing),
  MotivationMessage('Your nervous system deserves calm. Slow down, and the right words will come.', MotivationTheme.healing),
  MotivationMessage('There is light in you that no rejection can dim.', MotivationTheme.healing),
  MotivationMessage('Today, choose progress over perfection. You are doing better than you think.', MotivationTheme.healing),
  MotivationMessage('Let today be lighter. Drop the worry, keep the wisdom.', MotivationTheme.healing),
  MotivationMessage('Your energy is precious. Spend it on people and goals that honour you.', MotivationTheme.healing),
  MotivationMessage('Even the moon goes through phases. You are still whole in every one of them.', MotivationTheme.healing),
  MotivationMessage('Peace begins the moment you choose not to let another person\'s mood control your day.', MotivationTheme.healing),
  MotivationMessage('Healing hands, healing words, healing heart. You bring that to every client.', MotivationTheme.healing),
  MotivationMessage('Give yourself the same encouragement you would give your best friend.', MotivationTheme.healing),
  MotivationMessage('The storm passes. The sky remembers how to be blue. So will you.', MotivationTheme.healing),
  MotivationMessage('Calm is a superpower. Use it in every negotiation today.', MotivationTheme.healing),
  MotivationMessage('Your story is still being written, and the next chapter is full of light.', MotivationTheme.healing),
  MotivationMessage('Let your heart be the compass and your discipline be the engine.', MotivationTheme.healing),
  MotivationMessage('Today you can begin again, as many times as you need.', MotivationTheme.healing),
  MotivationMessage('Gentle reminder: you have survived every hard day so far. You will thrive today too.', MotivationTheme.healing),
  MotivationMessage('Inhale gratitude, exhale doubt. Now go make magic happen.', MotivationTheme.healing),

  // ── Positivity (33) ───────────────────────────────────────────────────────
  MotivationMessage('Good morning, superstar! Your smile is the best sales pitch in the world.', MotivationTheme.positivity),
  MotivationMessage('Today is full of approvals, warm conversations and happy customers. Go claim them!', MotivationTheme.positivity),
  MotivationMessage('Your positive energy turns strangers into clients and clients into friends.', MotivationTheme.positivity),
  MotivationMessage('Believe in the product, believe in the customer, but most of all, believe in Anjali.', MotivationTheme.positivity),
  MotivationMessage('One call, one smile, one closed deal at a time. You\'ve got this!', MotivationTheme.positivity),
  MotivationMessage('Gratitude turns what you have into enough, and your effort into abundance.', MotivationTheme.positivity),
  MotivationMessage('Every "not now" is one step closer to "let\'s do it!"', MotivationTheme.positivity),
  MotivationMessage('You are the reason someone\'s dream home, business or car becomes real.', MotivationTheme.positivity),
  MotivationMessage('Wake up with determination, go to bed with satisfaction.', MotivationTheme.positivity),
  MotivationMessage('Happiness is a strategy. Choose it first, and success follows.', MotivationTheme.positivity),
  MotivationMessage('You light up every room and every phone call. Keep shining!', MotivationTheme.positivity),
  MotivationMessage('Great things never come from comfort zones. Make that bold call today.', MotivationTheme.positivity),
  MotivationMessage('Your hard work is noticed, your effort is valued, and your success is inevitable.', MotivationTheme.positivity),
  MotivationMessage('Make today so awesome that yesterday gets jealous.', MotivationTheme.positivity),
  MotivationMessage('Positive mind, positive vibes, positive pipeline.', MotivationTheme.positivity),
  MotivationMessage('Be the energy you want to attract: joyful, confident and generous.', MotivationTheme.positivity),
  MotivationMessage('Your follow-ups are acts of care. Customers feel it, and they remember it.', MotivationTheme.positivity),
  MotivationMessage('Celebrate small wins today. Every document received is a victory!', MotivationTheme.positivity),
  MotivationMessage('Success is not luck. It is Anjali showing up, again and again, with a smile.', MotivationTheme.positivity),
  MotivationMessage('Today\'s goal: make one customer\'s day better. The numbers will follow.', MotivationTheme.positivity),
  MotivationMessage('Doubt kills more dreams than failure ever will. Choose belief today.', MotivationTheme.positivity),
  MotivationMessage('You are capable of amazing things. Today is proof waiting to happen.', MotivationTheme.positivity),
  MotivationMessage('Your confidence is contagious. Spread it generously!', MotivationTheme.positivity),
  MotivationMessage('Dream big, work smart, stay humble, shine bright.', MotivationTheme.positivity),
  MotivationMessage('The best is not behind you. The best is calling you on line one.', MotivationTheme.positivity),
  MotivationMessage('Winners are not people who never fail; they are people who never quit.', MotivationTheme.positivity),
  MotivationMessage('Sparkle like the lights around you. Today is a celebration of you!', MotivationTheme.positivity),
  MotivationMessage('Your future clients are already looking for someone like you. Be easy to find.', MotivationTheme.positivity),
  MotivationMessage('Turn your "I wish" into "I will" and your "I will" into "I did."', MotivationTheme.positivity),
  MotivationMessage('Good vibes, great follow-ups, grand results. That\'s today\'s plan.', MotivationTheme.positivity),
  MotivationMessage('You are not behind. You are building. Keep going, beautiful soul.', MotivationTheme.positivity),
  MotivationMessage('Every expert was once a beginner. Every top performer once made a first call.', MotivationTheme.positivity),
  MotivationMessage('Today, let your heart lead and your results will follow. Never miss a lead again!', MotivationTheme.positivity),
];
