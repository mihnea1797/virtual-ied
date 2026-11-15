// Unit test of SmpCntTracker (loss / reordering / duplicate accounting on smpCnt).
// Built as target `smpcnt-tracker-test`; run it from the build dir with `ctest` or directly.
// Prints "ok"; a failed check prints the case and exits 1.
#include "../SmpCntTracker.hpp"

#include <cstdio>
#include <cstdlib>
#include <initializer_list>

struct Counts
{
    uint64_t lost = 0, reordered = 0, duplicates = 0;
};

static Counts feed(SmpCntTracker &t, std::initializer_list<int> seq, Counts c = Counts())
{
    for (int s : seq)
        t.observe(static_cast<uint16_t>(s), c.lost, c.reordered, c.duplicates);
    return c;
}

static void expect(const char *name, const Counts &c, uint64_t lost, uint64_t reordered, uint64_t duplicates)
{
    if (c.lost == lost && c.reordered == reordered && c.duplicates == duplicates)
        return;
    std::printf("FAILED %s: lost/reordered/dup = %llu/%llu/%llu, expected %llu/%llu/%llu\n", name,
                (unsigned long long)c.lost, (unsigned long long)c.reordered, (unsigned long long)c.duplicates,
                (unsigned long long)lost, (unsigned long long)reordered, (unsigned long long)duplicates);
    std::exit(1);
}

int main()
{
    { SmpCntTracker t; expect("in order", feed(t, {7, 8, 9, 10, 11}), 0, 0, 0); }

    // The publisher counts 0..65534: the step 65534 -> 0 is in order (uint16 math saw a jump of 2).
    { SmpCntTracker t; expect("wrap 65534 -> 0", feed(t, {65533, 65534, 0, 1}), 0, 0, 0); }
    { SmpCntTracker t; expect("loss across the wrap", feed(t, {65533, 0, 1}), 1, 0, 0); }

    { SmpCntTracker t; expect("gap of two", feed(t, {10, 13, 14}), 2, 0, 0); }

    // One swapped pair: nothing lost (the old counter reported 2 losses for this).
    { SmpCntTracker t; expect("reordered pair", feed(t, {10, 12, 11, 13}), 0, 1, 0); }
    { SmpCntTracker t; expect("gap, one sample late, one lost", feed(t, {10, 14, 12, 15}), 2, 1, 0); }
    { SmpCntTracker t; expect("reordering across the wrap", feed(t, {65533, 0, 65534, 1}), 0, 1, 0); }

    { SmpCntTracker t; expect("adjacent duplicate", feed(t, {10, 10, 11}), 0, 0, 1); }
    { SmpCntTracker t; expect("late duplicate", feed(t, {10, 11, 12, 11, 13}), 0, 0, 1); }

    // Publisher restart: the count starts again at 1; no loss, and counting carries on after it.
    {
        SmpCntTracker t;
        Counts c = feed(t, {30998, 30999, 31000, 1, 2, 3});
        expect("restart", c, 0, 0, 0);
        expect("gap after restart", feed(t, {5}, c), 1, 0, 0);
    }

    // A hole from the previous counter cycle must not turn a late duplicate into "reordered".
    {
        SmpCntTracker t;
        Counts c = feed(t, {99, 101}); // 100 lost for good
        for (int s = 102; s < 65535; s++) c = feed(t, {s}, c);
        for (int s = 0; s <= 101; s++) c = feed(t, {s}, c); // next cycle: 100 arrives in order
        expect("full cycle, one loss", c, 1, 0, 0);
        expect("late duplicate of a number lost one cycle ago", feed(t, {100, 102}, c), 1, 0, 1);
    }

    // Any other modulus (e.g. a merging unit that wraps at its sample rate).
    { SmpCntTracker t(4000); expect("modulus 4000 wrap", feed(t, {3998, 3999, 0, 1}), 0, 0, 0); }

    std::printf("ok\n");
    return 0;
}
