#ifndef _SMPCNT_TRACKER_H
#define _SMPCNT_TRACKER_H

#include <algorithm>
#include <cstdint>
#include <vector>

// Sequence accounting on the SV sample counter (smpCnt) of ONE stream: tells samples that
// never arrived (lost) from samples that arrived late (reordered) and from repeats (duplicates).
// No dependencies, so it is unit-tested on its own (tests/test_smpcnt_tracker.cpp).
//
// The publisher counts smpCnt modulo `modulus`. libiec61850's SVPublisher default is 65535
// (values 0..65534), NOT a full uint16 cycle: plain uint16 subtraction reads the 65534 -> 0
// step as a jump of 2 and reports one phantom loss every 65535 samples (16.4 s at 4000 sa/s).
//
// With fwd = distance forward from the newest sample seen, back = modulus - fwd:
//   fwd == 1                 in order
//   fwd == 0                 duplicate
//   1 < fwd < jumpMax        gap: the skipped samples are presumed lost and remembered as holes
//   back < jumpMax, a hole   late sample: it fills its hole, so it is reordered, not lost
//   back <= kLateDupMax      late copy of a sample that did arrive: duplicate
//   anything else            publisher restart / resync: follow it and forget the holes
// A late sample never moves the "newest seen" position backwards; doing so made the next
// in-order sample look like a second gap (one reordered sample used to count as two losses).
//
// `lost` can go DOWN by one when a late sample fills its hole; it is never negative.
// Known corner: a publisher restart that lands 1..kLateDupMax below the newest sample is read
// as late duplicates until the new count passes that position (at most kLateDupMax samples).
class SmpCntTracker
{
public:
    static constexpr uint32_t kJumpMax    = 8000; // 2 s at 4000 sa/s: beyond this it is a restart, not a gap
    static constexpr uint32_t kLateDupMax = 64;   // 16 ms at 4000 sa/s

    explicit SmpCntTracker(uint32_t modulus = 65535)
        : _modulus(modulus < 2 ? 2 : modulus), _jumpMax(std::min(kJumpMax, _modulus / 2)), _hole(_modulus, 0) {}

    void observe(uint16_t smpCnt, uint64_t &lost, uint64_t &reordered, uint64_t &duplicates)
    {
        const uint32_t cur = smpCnt % _modulus;
        if (_last < 0)
        {
            _last = static_cast<int32_t>(cur);
            return;
        }

        const uint32_t last = static_cast<uint32_t>(_last);
        const uint32_t fwd  = (cur + _modulus - last) % _modulus;
        const uint32_t back = _modulus - fwd;

        if (fwd == 0)
        {
            duplicates++;
        }
        else if (fwd < _jumpMax)
        {
            for (uint32_t k = 1; k < fwd; k++)
                _hole[(last + k) % _modulus] = 1;
            lost += fwd - 1;
            _hole[cur] = 0; // also clears a hole left at this number one counter cycle ago
            _last = static_cast<int32_t>(cur);
        }
        else if (back < _jumpMax && _hole[cur])
        {
            _hole[cur] = 0;
            lost--; // a set hole was counted in lost exactly once, so this cannot underflow
            reordered++;
        }
        else if (back <= kLateDupMax)
        {
            duplicates++;
        }
        else
        {
            std::fill(_hole.begin(), _hole.end(), 0);
            _last = static_cast<int32_t>(cur);
        }
    }

private:
    uint32_t             _modulus;
    uint32_t             _jumpMax;  // kJumpMax, capped at half a cycle for a small modulus
    std::vector<uint8_t> _hole;     // 1 = this smpCnt was skipped and has not arrived since
    int32_t              _last = -1; // newest smpCnt seen; -1 before the first sample
};

#endif
