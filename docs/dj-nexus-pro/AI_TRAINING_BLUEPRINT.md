# DJ Nexus Pro: AI Model Training Blueprint

> Every model behind the Smart DJ Bot and the AI features in [SPEC.md §5](./SPEC.md#5-ai-feature-catalogue): datasets, architectures, the training pipeline, evaluation gates, compression, deployment and app integration.
> Version 1.0 · Owner: ML team

---

## Table of Contents

1. [Principles](#1-principles)
2. [Model Inventory](#2-model-inventory)
3. [Training Data](#3-training-data)
4. [Shared Foundations](#4-shared-foundations)
5. [Model Specifications](#5-model-specifications)
6. [Training Pipeline](#6-training-pipeline)
7. [Evaluation Metrics & Release Gates](#7-evaluation-metrics--release-gates)
8. [Compression & Packaging](#8-compression--packaging)
9. [Deployment Strategy](#9-deployment-strategy)
10. [Integration into DJ Nexus Pro](#10-integration-into-dj-nexus-pro)
11. [Master Access Integration](#11-master-access-integration)
12. [Compute Budget & Timeline](#12-compute-budget--timeline)

---

## 1. Principles

1. **One shared audio encoder, many small heads.** Analysis runs once per track and feeds BPM, key, genre, energy, emotion and structure. This keeps on-device analysis to about 10 tracks/minute on a mid-range phone.
2. **Classic DSP as a safety net.** Every analysis model has a DSP fallback (autocorrelation tempo, chroma template key). It is used when a model is missing, and flagged when the model and DSP strongly disagree.
3. **Only commercially usable data ships in production weights.** Research-only datasets (e.g. MUSDB18) are used for benchmarking and ablations, never for training shipped models (see §3.3).
4. **Real time is sacred.** No neural network runs on the audio thread. Models run ahead of time on worker threads or in the cloud, and their results are cached per track (see SPEC §10.2).
5. **Measure before shipping.** Every model has a numeric release gate (§7). A model that misses its gate does not ship, even if the feature is ready.

---

## 2. Model Inventory

> **Status (engine 0.1):** none of these models is trained yet. A1 BPM, A2 key and A3 beat grid / downbeat have signal-processing baselines in the engine (`djn_analyze_pcm`), and so does C3 stems (`djn_separate_stems`, two-stage HPSS, well below neural quality); see `dj-nexus-pro/engine/README.md`. Stem playback in the decks is model-agnostic: a trained separator only has to produce the three stem buffers. The trained models must beat these baselines on the release gates in §7 before they replace them.

| Group | Model | Architecture | Runs | Release |
|---|---|---|---|---|
| **A. Audio analysis** | A1 BPM Detection | Shared encoder + TCN beat/tempo head | Device | 1.0 |
| | A2 Key Detection | CQT CNN (key classification, 24 classes) | Device | 1.0 |
| | A3 Beat-Grid Alignment | Beat + downbeat TCN/transformer → DBN / DP grid fit | Device | 1.0 |
| | A4 Energy Level Classifier | Encoder head: regression 1–10 + 3-class | Device | 1.0 |
| | A5 Genre Classifier | Encoder head, multi-label (7 core + 30 sub-genres) | Device | 1.0 |
| | A6 Emotion Detection | Encoder head: valence/arousal regression + mood tags | Device | 1.0 |
| | A7 Build-Up Detector | Temporal transformer over beat-synchronous frames | Device | 1.0 |
| | A8 Drop Timing Predictor | Same backbone as A7, drop onset head + bar-count regression | Device | 1.0 |
| **B. Mixing intelligence** | B1 AI Transition Composer | Conditional sequence model (transformer decoder) → automation curves | Hybrid | 1.0 |
| | B2 AI Auto-Mix Engine | Scoring model + beam search; contextual bandit fine-tuning | Device | 1.0 |
| | B3 AI Cue Point Generator | Rules over A3/A7/A8 + learned ranking head | Device | 1.0 |
| | B4 AI BPM Stretching | DSP stretcher + neural transient/artefact enhancer (U-Net) | Hybrid | 1.0 |
| | B5 AI Key Shifting | DSP pitch shift on stems + formant-preserving vocoder for vocals | Hybrid | 1.0 |
| | B6 AI Harmonic Mixing Advisor | Learned compatibility model (pairwise, embedding-based) | Device | 1.0 |
| **C. Sound design** | C1 AI FX Synthesizer | Latent diffusion (text + BPM/length conditioning) | Cloud | 1.x |
| | C2 AI Vocal Chop Maker | C3 vocal stem → onset/syllable segmentation → pitch detect | Hybrid | 1.x |
| | C3 AI Stem Splitter Pro | Hybrid spectrogram/waveform U-Net (Demucs-family); fast + HQ variants | Hybrid | 1.0 |
| **D. Coaching & analytics** | D1 AI Set Analyzer | Aggregates A-models over a recording + transition quality model | Cloud | 1.0 |
| | D2 AI DJ Skill Coach | Gradient-boosted skill classifiers + templated/LLM feedback | Cloud | 1.x |
| | D3 AI Crowd Energy Simulator | LSTM + transformer hybrid over set features | Device | 2.0 |
| | D4 AI DJ Personality Mode Generator | Policy parameter sets learned by clustering + RL fine-tune | Device | 1.x |
| | D5 AI Track Mood Converter | Stem-level processing policy + conditional GAN/diffusion enhancer | Cloud | 2.0 |
| | D6 AI Set Storyline Creator | Arc planner (constraint optimisation) + LLM chapter naming | Cloud | 1.x |
| **E. Personalization** | E1 AI Mood-Based Set Builder | Text/mood → target curve; retrieval over embeddings; beam search | Device | 1.0 |
| | E2 AI Smart Sorting Engine | Per-user classifier on embeddings (few-shot, on-device fine-tune) | Device | 1.x |
| | E3 AI Auto-Tagging Engine | = A5 + A6 + instrument/vocal heads | Device | 1.0 |

---

## 3. Training Data

### 3.1 Data Needs by Type

| Need (from brief) | Sources | Target volume |
|---|---|---|
| Multi-genre EDM/techno/trance/psy audio | Licensed label catalogues (negotiate training licences with 3–5 electronic labels / a distributor); MTG-Jamendo and FMA tracks with commercial-use CC licences; in-house produced tracks | 60k tracks (≥ 5k per core genre) |
| Annotated BPM + key | GiantSteps Tempo & Key (benchmark), in-house annotation of licensed catalogue (BPM verified by tapping + DSP agreement; key by 2 trained annotators) | 20k tracks |
| Beat-grid aligned tracks | Harmonix Set (beats/downbeats/sections; features only), in-house grid corrections from DJ annotators | 10k tracks |
| Emotion-labelled tracks | DEAM, PMEmo (benchmark), in-house valence/arousal ratings (5 raters/track) | 8k tracks |
| Build-up and drop labels | In-house: section boundaries (intro, build, drop, break, outro) with bar positions | 6k tracks |
| Stems | Licensed multitracks (label stems, sample-pack stems), Slakh2100 (CC BY 4.0, synthesized), procedurally mixed stems from licensed loops | 1.5k real multitracks + 50k synthetic mixes |
| FX samples | In-house sound design library + licensed FX packs + CC0 Freesound samples | 40k one-shots/risers/impacts with text descriptions |
| Vocal datasets | Licensed acapellas + sample-pack vocals, with syllable onset labels on a 2k subset | 5k vocal clips |
| Crowd reaction | No usable public dataset exists. Collect with consent (see §3.4) | 300 hours of set audio with aligned crowd signals |
| DJ behaviour | Opt-in, anonymised in-app telemetry: track choices, skips, transition parameters, overrides in Crowd Mode | Grows with users |

### 3.2 Annotation Program

- **Tooling:** Label Studio with a custom waveform + beat-grid plugin.
- **Annotators:** working DJs (paid per track), trained on a 50-track gold set. An annotator stays on the project only while agreement with gold stays ≥ 90% (BPM ±0.5, grid ±10 ms, key exact or relative).
- **Double annotation** for key, emotion and sections; disagreements go to a third senior annotator.
- **Label schema (per track):** `bpm`, `tempo_map[]`, `downbeats[]`, `key`, `genre[]`, `subgenre[]`, `energy (1–10)`, `valence`, `arousal`, `moods[]`, `sections[{type,start_bar,end_bar}]`, `drops[]`, `vocal_regions[]`.

### 3.3 Dataset Licence Matrix

| Dataset | Content | Licence (verify before use) | Use in DJ Nexus Pro |
|---|---|---|---|
| GiantSteps Tempo / Key | EDM previews + tempo/key labels | Research; audio from store previews | **Benchmark only** |
| Harmonix Set | Beat/downbeat/section annotations, 900+ pop/dance tracks | Annotations open; audio not distributed | Benchmark + annotation-only pretraining where audio is licensed separately |
| MTG-Jamendo | 55k CC tracks, genre/mood/instrument tags | Per-track CC licence | **Train** on tracks whose licence allows commercial use; filter out NC tracks |
| FMA | 106k CC tracks with genre labels | Per-track CC licence | **Train** (commercial-use subset only) |
| DEAM / PMEmo | Emotion annotations | Research | **Benchmark only** |
| MUSDB18 / MUSDB18-HQ | 150 multitrack songs | Non-commercial / academic | **Benchmark only** (never in shipped stem weights) |
| MoisesDB | 240 multitracks | Check terms (non-commercial research at time of writing) | Benchmark unless a commercial licence is agreed |
| Slakh2100 | Synthesized multitracks | CC BY 4.0 | **Train** (stems, with attribution) |
| NSynth | 300k instrument notes | CC BY 4.0 | **Train** (FX synth pretraining) |
| Freesound / FSD50K | Sound events | Per-clip CC; use CC0 / CC BY only | **Train** (FX synth) |
| Licensed label catalogues | Full EDM tracks + stems | Negotiated training licence | **Train** (primary source) |
| Pretrained open weights (e.g. Demucs, Beat This!) | Model weights | Code licence ≠ data licence; review each | Use only after legal review of training data provenance |

### 3.4 Crowd Reaction Collection

- Partner with 10–20 clubs/festivals. Record set audio from the mixer, plus **non-identifying** crowd signals: floor-level motion energy from an overhead low-resolution sensor or accelerometer wristbands (opt-in), sound-level of crowd noise, bar sales per 15 minutes where available.
- No face images are stored. Venue signage and a written agreement with each venue; consent flows for wristband wearers.
- Label each 30 s window with a crowd energy score 0–1 (normalised per event).
- Until this dataset is big enough, the Crowd Energy Simulator ships as a clearly labelled *simulation* driven by track energy, transitions and set structure (see SPEC §5.4).

### 3.5 Data Governance

- Every file carries `source`, `licence`, `allowed_uses[]` and `consent_ref` in the data catalogue (DVC + a Postgres metadata table).
- Training jobs query the catalogue with `allowed_uses @> '{train_commercial}'`, so research-only data can't leak into shipped weights by accident.
- In-app telemetry used for training is opt-in, anonymised (user ID replaced by a rotating hash), and deletable on account deletion.

---

## 4. Shared Foundations

### 4.1 Audio Preprocessing

| Step | Setting |
|---|---|
| Decode | Mono mix-down for analysis (stereo kept for stems), resample to 22.05 kHz (analysis) / 44.1 kHz (stems, FX) |
| Loudness | Normalise to −14 LUFS for analysis models |
| Features | Log-mel spectrogram: 128 mels, n_fft 2048, hop 441 (≈ 20 ms at 22.05 kHz → 50 fps). CQT for key: 84 bins (7 octaves × 12), hop 20 ms. Chroma derived from CQT |
| Beat-synchronous pooling | Frames averaged per beat (from A1/A3) for structure and energy models, so tempo doesn't change the sequence length per bar |
| Windows | Training crops: 10 s (tagging), 30 s (tempo/key), full track at beat level (structure) |

### 4.2 Augmentation

Time-stretch ±8% (with matching BPM label changes), pitch-shift ±2 semitones (with key label rotation; disabled for genre), EQ tilt, mild compression, MP3/AAC re-encode at 128–320 kbps, background crowd noise and room reverb (to match recordings from the booth), random gain, mixup for tagging heads.

### 4.3 Shared Audio Encoder

- **Architecture:** CRNN front end (5 conv blocks, 3×3, channels 32→256, frequency pooling) → 4-layer transformer (d=256, 4 heads) over time → frame embeddings (50 fps) and a pooled 512-d track embedding.
- **Pretraining:** self-supervised contrastive learning (two augmented crops of the same track are positives, other tracks negatives), on the full 60k-track commercial-use corpus.
- **Then multi-task fine-tuning** with heads A1, A2 (via CQT branch), A4, A5, A6. Losses are weighted with uncertainty weighting so no task dominates.
- **Size:** ~6M parameters. Target INT8 on-device latency: ≤ 1.2 s for a 6-minute track on a Snapdragon 7-series phone.

---

## 5. Model Specifications

### A. Audio Analysis

**A1 BPM Detection**
- Input: log-mel frames. Output: beat activation (per frame) + tempo distribution over 60–200 BPM (1 BPM bins, with sub-bin refinement from inter-beat intervals).
- Architecture: multi-task TCN head (dilated temporal convolutions, as in recent beat-tracking literature) on the shared encoder.
- Octave correction: a genre-conditioned prior (e.g. psytrance 138–150, house 118–128, DnB 170–176 reported as 87 only if the user sets "half-time display").
- Loss: weighted BCE on beats (±2 frames label widening) + cross-entropy on tempo bins.
- Output to app: `bpm` (2 decimals), `bpm_confidence`, `tempo_map` (from A3 if tempo varies).

**A2 Key Detection**
- Input: CQT (84 bins) over 30 s crops, several crops per track aggregated by averaging logits.
- Architecture: all-convolutional key CNN (8 conv layers, global average pooling) → 24 classes (12 major + 12 minor), mapped to Camelot.
- Augmentation: pitch-shift with label rotation is the main tool; it multiplies the effective data by 5.
- Loss: cross-entropy with label smoothing 0.1.

**A3 Beat-Grid Alignment**
- Beat + downbeat activations from the encoder (transformer head for long-range bar structure).
- Post-processing: dynamic Bayesian network or dynamic-programming grid fit that assumes a mostly constant tempo (EDM) but allows tempo-map segments where the fit error exceeds a threshold (live drums, edits).
- The **Beat-Grid Corrector** feature re-runs A3 on a user's existing grid and proposes a fix when the mean offset > 8 ms or drift > 15 ms per 32 bars.

**A4 Energy Level Classifier**
- Inputs: encoder embedding sequence + handcrafted features (LUFS short-term, spectral flux, onset density, low-end RMS, spectral centroid).
- Heads: track energy regression (1–10), per-bar energy curve (used by set building), class head (low / medium / high).
- Labels: annotator ratings on a 1–10 scale, anchored with 20 reference tracks shown to every annotator.

**A5 Genre Classifier**
- Multi-label sigmoid head on the pooled embedding. Core labels: EDM, electro, techno, trance, house, psytrance, melodic techno. Plus ~30 sub-genres (progressive house, tech house, hard techno, uplifting trance, full-on psy, dark psy, DnB, dubstep...).
- Class-balanced focal loss. Per-class thresholds tuned on validation to maximise F1.
- Hierarchy consistency: sub-genre probabilities are masked by their parent genre.

**A6 Emotion Detection**
- Heads: valence and arousal regression (track-level and per-10 s), mood tags multi-label (euphoric, dark, hypnotic, uplifting, aggressive, dreamy, melancholic, groovy...).
- Loss: concordance correlation coefficient (CCC) loss for V/A, BCE for tags.

**A7 Build-Up Detector & A8 Drop Timing Predictor**
- Input: beat-synchronous features (one vector per beat: encoder frame mean, energy, low-end RMS, snare-roll onset density, riser detection features such as rising spectral centroid and noise ratio).
- Architecture: temporal transformer (6 layers, relative position encoding in beats) → per-beat labels (BIO tagging for intro/build/drop/break/outro) + a drop-onset head.
- The **Drop Timing Predictor** also runs in "live" mode on the playing deck: given the playhead position, it outputs *bars until next drop* with a confidence; the app shows a countdown only above 0.7 confidence.
- Loss: CRF on section tags + focal BCE on drop onsets (tolerance ±1 beat).

### B. Mixing Intelligence

**B1 AI Transition Composer**
- Task: given tracks A (outgoing) and B (incoming) with their analysis, generate a transition plan: entry point in B, exit point in A, length in bars, and automation curves (EQ low/mid/high, filter, fader, crossfader, FX sends) sampled per beat.
- Data: (1) transitions extracted from 3,000+ hours of DJ mixes whose use is licensed (e.g. commissioned mixes from partner DJs), by aligning the mix against the source tracks (DTW over chroma/mel) and estimating gain and EQ curves; (2) in-app opt-in logs of manual transitions from skilled users (high Set Analyzer scores).
- Architecture: transformer decoder conditioned on both tracks' beat-level embeddings and section tags; outputs quantized curve tokens (per beat, 32 levels per parameter). Sampling with 3 temperatures gives the 3 alternatives shown to the user.
- Style tokens condition on transition type (bass swap, echo out, filter blend, cut, long blend) and on the DJ Personality profile.
- Hybrid: a distilled 8M-parameter model runs on device. The full model runs in the cloud when online and the user asks for "more ideas".

**B2 AI Auto-Mix Engine**
- Track selection uses the compatibility score (SPEC §3.4), with weights learned from data rather than fixed:
  - Supervised stage: learning-to-rank (LambdaMART) on (current track, candidate) pairs from DJ mixes, where the actually played next track is the positive.
  - Online stage: a contextual bandit (Thompson sampling over weight vectors) using opt-in in-app rewards: +1 track played > 60 s, −1 skipped within 20 s, −0.5 user override in Crowd Mode.
- Transitions come from B1. Execution is scheduled on the beat grid by the engine.

**B3 AI Cue Point Generator**
- Candidates: first downbeat, phrase starts (every 16/32 bars) from A3, section boundaries from A7, drops from A8, vocal entry from the vocal-activity head.
- A small ranking model (gradient boosting) scores candidates against cue points placed by DJs in the annotation set and in opt-in user libraries, then picks up to 8 with diversity constraints. Colour follows a fixed convention (green = mix-in, red = drop, blue = break, orange = mix-out).

**B4 AI BPM Stretching**
- Base: commercial phase-vocoder / time-domain stretcher (Rubber Band or Superpowered; SPEC §10.1) for real time.
- Offline HQ render: a 1D U-Net enhancer trained to remove stretching artefacts (transient smearing, phasiness). Training pairs: tracks stretched by the DSP vs. the same tracks re-rendered at the target tempo from stems/MIDI (Slakh and licensed multitracks) as ground truth.
- Loss: multi-resolution STFT loss + adversarial loss (HiFi-GAN-style discriminators).

**B5 AI Key Shifting**
- Instrument stems: DSP pitch shift. Vocal stem: formant-preserving shifting with a neural vocoder (source-filter decomposition → shift F0 → resynthesize). Recombine.
- Training data: licensed acapellas with pitch-shifted pairs synthesized by a WORLD-style vocoder as targets; evaluate by listener MOS.

**B6 AI Harmonic Mixing Advisor**
- Beyond Camelot rules: a pairwise model that predicts whether two tracks sound good layered, using chroma profiles per section (many EDM tracks change mode or have atonal drops) plus the embedding.
- Siamese network over (A section, B section) chroma + embeddings → compatibility probability. Labels: pairs from DJ mixes where both tracks overlapped ≥ 8 bars (positive) vs. random pairs matched on BPM (negative), plus rater judgements for 3k pairs.

### C. Sound Design

**C1 AI FX Synthesizer**
- Latent diffusion model: a VAE compresses 44.1 kHz stereo audio to latents; a diffusion transformer denoises latents conditioned on a text embedding (CLAP-style audio-text model trained on our own FX library captions), plus numeric conditioning on BPM, length in bars and key.
- Data: 40k FX with captions written by sound designers ("white-noise riser, 8 bars, filtered, ends with a reverse cymbal"). Only in-house, licensed and CC0/CC BY sounds.
- Output: 1–16 bars, tempo-locked, trimmed to the grid, loudness-normalised, written as a sampler pad.
- Safety: output fingerprinted against the training set to block near-copies (cosine similarity threshold on the CLAP embedding).

**C2 AI Vocal Chop Maker**
- Pipeline: C3 vocal stem → vocal activity detection → syllable/onset segmentation (CRNN onset network trained on 2k labelled vocal clips) → pitch estimate per slice (CREPE-style pitch CNN) → pick 8 slices maximising pitch variety and clarity → tune each to the deck key → map to pads with names like "hey (C#)".

**C3 AI Stem Splitter Pro**
- Architecture: hybrid spectrogram + waveform U-Net with cross-domain transformer layers (Demucs-family design).
- Variants:
  - **Fast (on device):** ~10M parameters after distillation, 4 stems, runs in the background after a track is loaded. Expect roughly 1–3 minutes per track on current flagship phones, so results are cached, not real time.
  - **HQ (cloud):** full-size model, 4 stems (optionally 6: + piano, guitar), ~30 s per track on an L4 GPU.
- Training: Slakh2100 + licensed multitracks + on-the-fly remixing (random stems from different songs, tempo-aligned, to create new mixtures), which multiplies effective data.
- Loss: L1 on waveform + multi-resolution STFT loss.
- Real-time use: the engine plays cached stems in sync with the full track; stem faders crossfade between the full mix and the stem sum, so small separation artefacts are masked in normal use.

### D. Coaching & Analytics

**D1 AI Set Analyzer**
- Runs A-models on the recording, aligns it to the tracklist (from deck history), and scores every transition with a **transition quality model**: a classifier trained on rater-labelled transitions (1–5 stars) using features such as beat-phase error over the overlap, key clash from B6, low-end overlap energy (two kicks or basslines at once), loudness jump and phrase alignment.
- Output: energy curve, BPM/key paths, per-transition scores with the reason, and the three weakest moments with timestamps.

**D2 AI DJ Skill Coach**
- Skill dimensions: beatmatching, phrasing, EQ technique, harmonic choice, energy management, FX use.
- Per-dimension gradient-boosted classifiers on D1 features across a user's last 10 sets → skill level 1–5 with a trend.
- Feedback text: templates selected by rule for predictable advice, rephrased by an LLM (e.g. a Claude model via API) with the metrics as grounding, so advice never invents numbers. Drills link to practice modes in the app.

**D3 AI Crowd Energy Simulator**
- Input: per-bar features of the set (energy curve, transitions, drops, time since last peak, BPM changes).
- Architecture: LSTM + transformer hybrid (LSTM for short-term momentum, transformer over the last 30 minutes for fatigue and long arcs) → crowd energy 0–1 per bar.
- Trained on the §3.4 crowd dataset. Until that exists, it's a calibrated rule-based simulator (2.0 target).

**D4 AI DJ Personality Mode Generator**
- Cluster DJ mixes (by BPM range, transition length, FX density, genre spread, energy volatility) into 6–10 archetypes. Each archetype becomes a parameter set for B1 (style tokens) and B2 (score weights, energy step).
- Optional RL fine-tune of the B2 policy per archetype with a reward that combines listener engagement and closeness to the archetype statistics.
- Archetypes are named by style, never after real DJs.

**D5 AI Track Mood Converter**
- Stage 1 (policy): given a target mood shift (e.g. darker, more euphoric), predict stem-level processing: EQ tilt, reverb size, stem gains, key/mode change via B5, saturation.
- Stage 2 (enhancer): conditional GAN or diffusion enhancer to clean up artefacts after processing.
- Evaluation: A6 on the output must move toward the target (Δvalence/Δarousal), and listeners must rate it acceptable (MOS ≥ 3.5).

**D6 AI Set Storyline Creator**
- Given length and style, it plans chapters with target energy/BPM/mood ranges (constraint optimisation over the user's library, using A4/A6 per-bar curves), then fills each chapter with B2.
- An LLM names chapters and writes a short story line for the set description (useful for YouTube/Mixcloud posts).
- Coherence scoring: see §7.

### E. Personalization

**E1 AI Mood-Based Set Builder:** maps a text prompt or mood picker to a target (energy curve, mood tags, BPM range) with a small text encoder trained on prompt→target pairs (synthetic prompts + curated examples), then retrieves candidates by embedding similarity and orders them with B2's beam search.

**E2 AI Smart Sorting Engine:** a per-user logistic regression / small MLP on the frozen track embedding, trained on-device from the user's own crates and overrides (fine-tuned when the phone is charging). Proposes crates for new tracks with a confidence threshold. No user data leaves the device.

**E3 AI Auto-Tagging Engine:** A5 + A6 heads plus instrument (multi-label) and vocal/instrumental heads trained on MTG-Jamendo commercial-use tags and in-house labels.

---

## 6. Training Pipeline

| Step | What happens | Tools |
|---|---|---|
| 1. Data ingestion | Pull licensed audio and annotations into the catalogue with licence metadata; dedupe by Chromaprint; split **by artist** into train/val/test (80/10/10) so the same artist never appears in two splits | DVC, Postgres catalogue, R2 |
| 2. Audio preprocessing | Decode, resample, loudness-normalise, compute and cache mel/CQT features as sharded WebDataset tar files | torchaudio, nnAudio, Ray |
| 3. Label alignment | Convert beat/bar-based labels to frame indices; check annotation/audio offsets with an onset cross-correlation; reject files with > 20 ms drift | Custom scripts |
| 4. Model training | PyTorch Lightning, mixed precision (bf16), DDP on 8× GPU nodes; shared encoder first, then heads | PyTorch, Lightning |
| 5. Hyperparameter tuning | Bayesian search (40–80 trials per model) over learning rate, dropout, augmentation strength, loss weights; early stopping on validation metric | Optuna, W&B Sweeps |
| 6. Validation | Every epoch on validation split + GiantSteps / Harmonix / DEAM / MUSDB benchmarks (benchmarks never used for training) | W&B |
| 7. Testing | Frozen test split + a **"booth set"** of 500 tracks re-recorded through phone speakers/cheap interfaces + adversarial cases (tempo changes, ambient intros, live recordings) | Custom eval harness |
| 8. Model compression | Distillation → pruning → INT8 quantization (QAT where PTQ loses > 1 point) → export | PyTorch → ONNX → LiteRT / Core ML (coremltools) |
| 9. Deployment packaging | Signed model bundle + manifest entry (version, SHA-256, min app version, rollout %) uploaded to R2 | CI pipeline (GitHub Actions) |

Reproducibility: every run logs git SHA, dataset version (DVC hash), config and seeds. A shipped model must be reproducible from its run ID.

---

## 7. Evaluation Metrics & Release Gates

Targets are starting points. Calibrate them against the first baseline and against competing apps on the same test set, then freeze them as regression gates.

| Metric | Models | Definition | Ship gate |
|---|---|---|---|
| **BPM accuracy** | A1 | Accuracy1: estimate within ±4% of truth. Accuracy2: also allows ×2, ×½, ×3, ×⅓ errors | In-house EDM test: Acc1 ≥ 95%, Acc2 ≥ 99%. GiantSteps Tempo: no regression vs. previous release |
| Beat / downbeat F-measure | A3 | F1 with ±70 ms tolerance | Beat F ≥ 0.95, downbeat F ≥ 0.85 on in-house EDM test |
| **Key detection accuracy** | A2 | Exact accuracy + MIREX weighted score (fifth 0.5, relative 0.3, parallel 0.2) | Weighted ≥ 0.80, exact ≥ 0.72 on in-house EDM; no GiantSteps Key regression |
| **Genre classification F1** | A5 | Macro-F1 over the 7 core genres; micro-F1 over sub-genres | Core macro-F1 ≥ 0.82; sub-genre micro-F1 ≥ 0.65 |
| Energy | A4 | MAE on 1–10 scale; 3-class accuracy | MAE ≤ 0.9; class accuracy ≥ 0.80 |
| **Emotion detection precision** | A6 | Macro precision@3 for mood tags; CCC for valence/arousal | Tag precision@3 ≥ 0.70; CCC arousal ≥ 0.70, valence ≥ 0.50 |
| Build-up / drop | A7, A8 | Section boundary F1 (±1 bar); drop onset F1 (±1 beat); countdown error in bars | Boundary F1 ≥ 0.75; drop F1 ≥ 0.85; median countdown error ≤ 1 bar |
| **Stem separation SDR** | C3 | Mean SDR (dB) over vocals/drums/bass/other (museval), on held-out licensed multitracks + MUSDB18-HQ test as a benchmark | HQ ≥ 8.5 dB; Fast on-device ≥ 6.5 dB |
| **FX generation realism** | C1 | Fréchet Audio Distance (FAD) vs. held-out FX set + CLAP text-audio alignment score + MOS (1–5, 20 sound designers, blind vs. real FX) | MOS ≥ 3.8 and within 0.4 of real FX; FAD improving release over release |
| **Transition smoothness rating** | B1, B2, D1 | Human MOS (1–5) from 30 DJs, blind vs. human transitions; objective: beat-phase error, key clash rate, low-end overlap | MOS ≥ 3.8; ≤ 5% of AI transitions rated ≤ 2 |
| Harmonic advisor | B6 | ROC-AUC on rater-labelled pairs | AUC ≥ 0.85 |
| **Crowd energy prediction accuracy** | D3 | Spearman ρ between predicted and measured crowd energy per 30 s window; MAE | ρ ≥ 0.6 on held-out events before leaving "simulation" labelling |
| **Set storyline coherence score** | D6, E1 | Composite: arc fit (RMSE between planned and realised energy curve) + harmonic flow (% compatible transitions) + human coherence rating (1–5) | Arc RMSE ≤ 1.0; ≥ 90% compatible transitions; human ≥ 4.0 |
| Latency | all on-device | p95 per-track analysis time on reference devices | ≤ 3 s (A-models), ≤ 180 s (C3 fast) on Snapdragon 7-series / A15 |
| Model size | all on-device | Compressed bundle size | Analysis bundle ≤ 25 MB; C3 fast ≤ 40 MB (downloaded on demand) |

**Bias and coverage checks:** report every metric per genre, per tempo band and per recording quality, so a model can't hide a failing genre (for example psytrance octave errors) behind a strong average.

---

## 8. Compression & Packaging

1. **Distillation:** a large teacher (encoder ~40M params) trains the 6M on-device student using soft labels + feature matching.
2. **Structured pruning:** remove 20–40% of conv channels by L1 norm, then fine-tune.
3. **Quantization:** INT8 post-training quantization with a 500-track calibration set; quantization-aware training for models that lose > 1 metric point (usually A2 and C3).
4. **Export:** PyTorch → ONNX → LiteRT (`.tflite`, NNAPI/GPU delegates) and Core ML (`.mlpackage`, ANE-compatible ops only; unsupported ops rewritten).
5. **Parity test:** exported model vs. PyTorch on 200 tracks: metrics within 0.5 points, max absolute logit difference logged.
6. **Bundle:** `{name}-{version}-{platform}.bundle` = model file + `meta.json` (input spec, label map, preprocessing params, metric snapshot) + SHA-256, signed with the release key.

---

## 9. Deployment Strategy

| Tier | What runs there | Why |
|---|---|---|
| **On-device inference** | A1–A8, B2, B3, B6, E1–E3, fast C3, distilled B1, D3/D4 | Offline gigs, privacy (audio stays on the phone), no per-use cost |
| **Cloud inference** | C1, HQ C3, B4/B5 HQ renders, D1, D2, D5, D6, full B1 | Too heavy for phones or needs large models |
| **Hybrid caching** | Analysis results, stems and waveforms cached per track (keyed by file hash + model version). Cloud outputs cached on device after download. Cross-device: analysis results sync by fingerprint (not audio), so a tablet doesn't re-analyse tracks the phone already did | Avoid repeat work |
| **Latency optimisation** | Background analysis queue ordered by "likely to be played next" (Smart Queue, recent adds); delegates chosen per device from a benchmark on first run; cloud jobs use pre-signed direct uploads and GPU autoscaling on queue depth | The next track is ready before you need it |

**Rollout:** new model versions go out through the manifest at 5% → 25% → 100%, watching on-device metrics (analysis failure rate, user BPM/key override rate, Smart Queue skip rate). Automatic rollback if the override rate rises > 20% relative.

**Fallback order for analysis:** current model → previous model → DSP algorithm. The UI shows a small "estimated" badge when DSP was used.

---

## 10. Integration into DJ Nexus Pro

### 10.1 API Endpoints (cloud AI)

| Method | Path | Body / result |
|---|---|---|
| POST | `/v1/ai/jobs` | `{ kind: "stems_hq" \| "fx_synth" \| "mastering" \| "set_analysis" \| "transition_ideas" \| "mood_convert" \| "genre_morph" \| "storyline", params }` → `{ job_id, upload_url? }` |
| GET | `/v1/ai/jobs/{id}` | `{ status, progress, output_urls[], model_version }` |
| GET | `/v1/models/manifest?platform=android&app=1.0.3` | List of on-device bundles the user is entitled to, with URLs + SHA-256 |
| POST | `/v1/ai/feedback` | Opt-in signals: override (BPM/key/genre), transition rating, skip. Feeds §3.1 behaviour data |

### 10.2 Local Inference Modules

```
app/lib/core/ml/
├── model_manager.dart      # downloads bundles from manifest, verifies SHA-256 + signature, picks delegate
├── analysis_worker.dart    # background isolate: decode → features → encoder → heads → DB
├── live_predictors.dart    # drop countdown, Live FX Assistant, clash meter (UI-rate, not audio thread)
└── queue_engine.dart       # B2 scoring + beam search for Smart Queue / Crowd Mode / Emergency Mix
engine/src/ml_bridge/       # C++ helpers: feature extraction shared with DSP code (same mel/CQT as training)
```

Feature extraction on device must match training exactly. The mel/CQT code lives in C++ and is compiled into both the app and a Python extension used by the training pipeline, with a unit test comparing outputs.

### 10.3 Real-Time Audio Engine Integration

- Models never run on the audio thread. They produce **plans** (cue points, grid, transition automation, FX triggers), and the engine executes plans sample-accurately against the beat grid.
- A transition plan is a list of `(beat_index, parameter, value)` events. The engine interpolates them per buffer, so an AI transition sounds as tight as a manual one.
- Stems: cached stem files load into the deck as a 4-channel source; the stem mixer sits before the channel EQ.

### 10.4 Feature Wiring

| App surface | Models |
|---|---|
| Smart DJ Bot (scan, analysis, playlists) | A1–A6, E3, A7/A8 |
| Playlist generator / Set builder | E1, B2, B6, D6 |
| Deck screen | A3 (grid), A8 (countdown), B3 (cues), B1 (transition), live predictors, C3 (stems) |
| Crowd Mode / Emergency Mix | B2 + B1 (distilled) |
| FX & Sampler Hub | C1 (FX synth), C2 (vocal chops) |
| Recordings | D1, D2, mastering, D6 (description text) |

---

## 11. Master Access Integration

Master access works through entitlements (SPEC §8 and §17), not credentials in the AI code:

| Brief requirement | AI-side behaviour when the entitlement token has `plan: MASTER` / `ai:*` |
|---|---|
| `EnableAllAIModels()` | `/models/manifest` returns every on-device bundle, including Labs (2.0) models; the app enables every AI toggle |
| `BypassSubscriptionChecks()` | Cloud AI jobs skip minute/credit accounting (`cloud_ai:unlimited`) |
| `UnlockAllPremiumFeatures()` | All AI features visible and usable; no paywall prompts |
| Priority | Master jobs are queued at priority 0 (ahead of Premium at 5) |

The AI services check `ent` claims from the verified token on every request. They never check usernames or passwords.

---

## 12. Compute Budget & Timeline

| Phase | Months | Work | GPU estimate |
|---|---|---|---|
| Data | 0–3 | Licensing deals, annotation program (20k tracks), catalogue | — |
| Foundations | 1–3 | Encoder pretraining + A1/A2/A4/A5 heads | ~2,000 A100-hours |
| Structure & mixing | 2–5 | A3, A6, A7, A8, B2, B3, B6, distilled B1 | ~1,500 A100-hours |
| Stems | 2–5 | C3 fast + HQ | ~4,000 A100-hours |
| 1.x models | 6–12 | C1, C2, D1, D2, D4, D6, full B1, B4/B5 enhancers | ~6,000 A100-hours |
| 2.0 research | 12+ | D3, D5, genre morphing | ~5,000 A100-hours |

At roughly $1.5–2.5 per A100-hour on current cloud GPU marketplaces, the full plan above (~18,500 A100-hours) is about $28–46k in compute. Year one alone (everything except 2.0 research, ~13,500 A100-hours) is about $20–34k. Annotation (≈ $4–6 per track for 20k tracks, double-annotated) and data licences are the larger costs; budget them separately.
