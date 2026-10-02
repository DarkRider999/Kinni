// Unit tests for the next-track advisor (src/core/advisor.cpp).
#include "advisor.h"
#include "test.h"

namespace {
djn::TrackInfo track(double bpm, int pc, bool minor, double energy, const char* genre = "",
                     double sinceSec = -1.0, double bias = 0.0) {
  djn::TrackInfo t;
  t.bpm = bpm;
  t.key_pitch_class = pc;
  t.key_is_minor = minor;
  t.energy = energy;
  t.genre = genre;
  t.seconds_since_played = sinceSec;
  t.user_bias = bias;
  return t;
}
}  // namespace

TEST(identical_key_and_tempo_scores_perfectly_on_those_axes) {
  const auto current = track(128.0, 0, false, 6.0, "techno");
  const auto candidate = track(128.0, 0, false, 6.0, "techno");
  const auto s = djn::scoreNextTrack(current, candidate);
  CHECK_NEAR(s.harmonic, 1.0, 1e-9);
  CHECK_NEAR(s.tempo, 1.0, 1e-9);
  CHECK(s.total > 0.9);
}

TEST(relative_major_minor_scores_higher_than_a_distant_key) {
  const auto current = track(128.0, 0, false, 6.0);        // C major (8B)
  const auto relative = track(128.0, 9, true, 6.0);        // A minor (8A) -- same Camelot number
  const auto distant = track(128.0, 6, false, 6.0);        // F# major (2B) -- opposite side of the wheel
  const auto sRel = djn::scoreNextTrack(current, relative);
  const auto sDist = djn::scoreNextTrack(current, distant);
  CHECK(sRel.harmonic > sDist.harmonic);
}

TEST(adjacent_camelot_number_beats_two_steps_away) {
  const auto current = track(128.0, 0, false, 6.0);  // 8B
  const auto adjacent = track(128.0, 7, false, 6.0); // G major, 9B: one step around the wheel
  const auto twoAway = track(128.0, 2, false, 6.0);  // D major, 10B: two steps around the wheel
  const auto sAdj = djn::scoreNextTrack(current, adjacent);
  const auto sTwo = djn::scoreNextTrack(current, twoAway);
  CHECK(sAdj.harmonic > sTwo.harmonic);
}

TEST(unknown_key_is_neutral_not_penalized_to_zero) {
  const auto current = track(128.0, -1, false, 6.0);
  const auto candidate = track(128.0, 0, false, 6.0);
  const auto s = djn::scoreNextTrack(current, candidate);
  CHECK_NEAR(s.harmonic, 0.5, 1e-9);
}

TEST(tempo_score_favors_close_bpm_and_credits_half_time) {
  const auto current = track(128.0, -1, false, 6.0);
  const auto close = track(130.0, -1, false, 6.0);
  const auto far = track(100.0, -1, false, 6.0);
  const auto halfTime = track(64.0, -1, false, 6.0);  // exact half-time of 128
  CHECK(djn::scoreNextTrack(current, close).tempo > djn::scoreNextTrack(current, far).tempo);
  CHECK(djn::scoreNextTrack(current, halfTime).tempo > djn::scoreNextTrack(current, far).tempo);
}

TEST(energy_score_prefers_the_arc_target_over_the_current_track) {
  const auto current = track(128.0, -1, false, 4.0);
  const auto highEnergy = track(128.0, -1, false, 9.0);
  const auto lowEnergy = track(128.0, -1, false, 2.0);
  // With no explicit target, staying near the current track's energy wins.
  CHECK(djn::scoreNextTrack(current, lowEnergy).energy > djn::scoreNextTrack(current, highEnergy).energy);
  // Peak-time arc target of 9: now the high-energy candidate should win instead.
  CHECK(djn::scoreNextTrack(current, highEnergy, 9.0).energy > djn::scoreNextTrack(current, lowEnergy, 9.0).energy);
}

TEST(genre_match_beats_genre_mismatch_and_unknown_is_neutral) {
  const auto current = track(128.0, -1, false, 6.0, "Techno");
  const auto same = track(128.0, -1, false, 6.0, "techno");  // case-insensitive match
  const auto other = track(128.0, -1, false, 6.0, "Pop");
  const auto unknown = track(128.0, -1, false, 6.0, "");
  CHECK(djn::scoreNextTrack(current, same).genre > djn::scoreNextTrack(current, other).genre);
  CHECK_NEAR(djn::scoreNextTrack(current, unknown).genre, 0.5, 1e-9);
}

TEST(never_played_beats_just_played_on_recency) {
  const auto current = track(128.0, -1, false, 6.0);
  const auto fresh = track(128.0, -1, false, 6.0, "", -1.0);
  const auto justPlayed = track(128.0, -1, false, 6.0, "", 0.0);
  CHECK(djn::scoreNextTrack(current, fresh).recency > djn::scoreNextTrack(current, justPlayed).recency);
}

TEST(positive_user_bias_raises_the_total_without_changing_sub_scores) {
  // Energy deliberately off from `current` so the unbiased total has headroom
  // below 1.0 -- otherwise a candidate that's already a perfect match on every
  // other axis clamps to 1.0 regardless of bias, hiding the effect being tested.
  const auto current = track(128.0, 0, false, 6.0, "techno");
  const auto neutral = track(128.0, 0, false, 3.0, "techno", -1.0, 0.0);
  const auto favored = track(128.0, 0, false, 3.0, "techno", -1.0, 1.0);
  const auto sN = djn::scoreNextTrack(current, neutral);
  const auto sF = djn::scoreNextTrack(current, favored);
  CHECK_NEAR(sN.harmonic, sF.harmonic, 1e-9);
  CHECK(sF.total > sN.total);
}

TEST(weights_of_zero_for_every_axis_but_one_isolate_that_axis) {
  djn::AdvisorWeights onlyHarmonic;
  onlyHarmonic.harmonic = 1.0;
  onlyHarmonic.tempo = onlyHarmonic.energy = onlyHarmonic.genre = onlyHarmonic.recency = onlyHarmonic.bias = 0.0;
  const auto current = track(128.0, 0, false, 6.0);
  const auto perfectKeyBadTempo = track(999.0, 0, false, 6.0);
  const auto s = djn::scoreNextTrack(current, perfectKeyBadTempo, -1.0, onlyHarmonic);
  CHECK_NEAR(s.total, 1.0, 1e-9);  // only harmonic counts, and it's a perfect match
}
