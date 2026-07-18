# Context Fragmentation in Streaming ASR

## Problem

Streaming Automatic Speech Recognition (ASR) systems typically process audio in small chunks (e.g., 300–800 ms) to reduce latency. However, naively splitting audio introduces **context fragmentation**, where the model loses acoustic, linguistic, or semantic context across chunk boundaries.

This issue is especially problematic for:

- Mixed-language (code-switching) speech (e.g., English ↔ Vietnamese)
- Long words crossing chunk boundaries
- Proper nouns
- Homophones
- Punctuation restoration
- Language identification
- Streaming translation

---

## Example

Instead of:

```
Cho mình book một khách sạn.
```

A naive chunk split may become:

```
Chunk 1:
Cho mình bo

Chunk 2:
ok một khách sạn
```

or

```
Chunk 1:
Cho mình book

Chunk 2:
một khách sạn
```

Without sufficient context, the ASR may incorrectly recognize:

- "book"
- "booking"
- "búc"
- "Book" (proper noun)

---

# Context Fragmentation Countermeasures

| Method | Description | Advantages | Trade-offs |
|---------|-------------|------------|------------|
| **Overlapping Chunks** | Consecutive chunks overlap by a percentage (typically 20–40%) so boundary audio is processed twice. | Simple, robust, improves recognition near boundaries. | Extra computation, requires transcript merging. |
| **Sliding Window** | Continuously move a fixed-size window over incoming audio instead of processing isolated chunks. | Preserves recent acoustic context, widely used in streaming ASR. | Repeated inference over overlapping audio. |
| **Context Carry-over** | Feed previous transcript, decoder state, or cached context into the next decoding step. | Strong language continuity, reduces fragmentation. | Depends on model/runtime support (e.g., KV cache). |
| **KV Cache Reuse** | Reuse decoder attention cache between decoding iterations instead of recomputing previous tokens. | Significantly lowers decoder computation. | Only available for compatible autoregressive models. |
| **Look-ahead Buffer** | Delay finalization by 100–300 ms to provide future context before committing transcript. | Improves ambiguous word recognition and punctuation. | Slight increase in latency. |
| **Stable Prefix Locking** | Lock transcript portions that are unlikely to change while allowing only recent words to update. | Reduces transcript flickering, improves UX. | Requires stability detection logic. |
| **Dynamic Chunk Boundary Detection** | Create chunk boundaries based on pauses, VAD, or linguistic cues instead of fixed intervals. | Produces more natural segmentation and better recognition. | More complex implementation. |
| **Confidence-based Commit** | Delay low-confidence words until additional context is available. | Higher transcript stability and accuracy. | Small latency increase for uncertain words. |
| **Language-aware Chunking** *(Research)* | Detect language transitions and avoid splitting during language switches. | Better handling of code-switching speech. | Research topic; limited open-source implementations. |
| **Streaming Translation Buffer** | Delay translation until ASR output becomes sufficiently stable. | Prevents unstable translations caused by transcript revisions. | Adds small translation delay. |

---

# Typical Production Pipeline

```
Microphone
      │
      ▼
Voice Activity Detection (VAD)
      │
      ▼
Adaptive / Fixed Chunking
      │
      ▼
Overlapping Sliding Window
      │
      ▼
Streaming ASR
      │
      ▼
Stable Prefix Detection
      │
      ▼
Context Carry-over / KV Cache
      │
      ▼
Incremental Transcript
      │
      ▼
Streaming Translation
      │
      ▼
(Optional) Text-to-Speech
```

---

# Recommended Configuration for English ↔ Vietnamese Streaming ASR

| Component | Suggested Configuration |
|-----------|-------------------------|
| Chunk Size | 500–700 ms |
| Chunk Overlap | 20–40% |
| Look-ahead Buffer | 100–200 ms |
| Voice Activity Detection | Silero VAD or WebRTC VAD |
| Context Strategy | Sliding Window + Context Carry-over |
| Transcript Strategy | Stable Prefix Locking |
| Translation Strategy | Wait until transcript is stable before translating |

---

# Priority (Highest ROI)

1. Voice Activity Detection (VAD)
2. Fixed Chunking (500–700 ms)
3. Overlapping Chunks (20–40%)
4. Sliding Window
5. Stable Prefix Locking
6. Look-ahead Buffer (100–200 ms)
7. Context Carry-over / KV Cache
8. Dynamic Chunk Boundary Detection
9. Confidence-based Commit
10. Language-aware Chunking (Research)

---

# Notes

- **Latency and stability are a trade-off.** A small look-ahead buffer (100–200 ms) can significantly improve transcript quality while remaining imperceptible to users.
- **Overlapping chunks and sliding windows** are the most widely adopted techniques in production streaming ASR systems.
- **Stable Prefix Locking** is primarily a UX optimization but greatly improves perceived responsiveness by reducing transcript flicker.
- **Language-aware chunking** remains an active research area and is particularly relevant for multilingual, code-switching applications such as English ↔ Vietnamese live translation.