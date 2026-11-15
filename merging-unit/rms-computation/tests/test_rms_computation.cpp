// Unit test of RmsComputationObject, the sliding one-period RMS whose threshold crossing raises
// the trip. Built as target `rms-computation-test`; run with `ctest` from the build dir.
// Prints "ok"; a failed check prints the case with the value it got and exits 1.
#include "RmsComputationObject.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>

static const int    N         = 80;    // samples per period: 4000 sa/s at 50 Hz
static const double PI        = 3.14159265358979323846;
static const double THRESHOLD = 230.0; // config.json "threshold"

// One sample as the vIED sees it: the publisher sends ampRms * sqrt(2) * sin(2 pi n / N) as a
// FLOAT32, the subscriber multiplies by 1000 and truncates to int32 (parseSVData).
static int32_t sample(double ampRms, long n)
{
    float f = static_cast<float>(ampRms * std::sqrt(2.0) * std::sin(2.0 * PI * static_cast<double>(n % N) / N));
    return static_cast<int32_t>(f * 1000.0f);
}

static void near(const char *what, double got, double want, double tol)
{
    if (std::fabs(got - want) <= tol)
        return;
    std::printf("FAILED %s: got %.6f, expected %.6f\n", what, got, want);
    std::exit(1);
}

int main()
{
    // The production path: built from the stream's "signalProperties" JSON.
    RmsComputationObject r(nlohmann::json{{"samplesPerPeriod", N}, {"scalingConstant", 1000}});
    long n = 0;

    // Warm-up: no value until one full period has been seen, then the RMS of that period.
    for (; n < N - 1; n++)
        near("warm-up returns 0", r.computeValue(sample(210.0, n)), 0.0, 0.0);
    near("first full period", r.computeValue(sample(210.0, n++)), 210.0, 0.01);

    // Steady sine: the RMS equals the amplitude at every sample (the window is one whole period).
    for (int i = 0; i < 10 * N; i++)
        near("steady 210 V", r.computeValue(sample(210.0, n++)), 210.0, 0.01);

    // The testbed's trip: amplitude step 210 -> 250 at phase 0 (the publisher steps at 10 s, a
    // whole number of periods). The RMS passes 230 at the 33rd stepped sample, i.e. 32 sample
    // intervals = 8.0 ms at 4000 sa/s after the first one. With 2 x 5 ms of propagation this is
    // the 18.2 ms t_trip floor; if this number moves, the floor moves with it.
    long k = 1;
    while (r.computeValue(sample(250.0, n++)) <= THRESHOLD)
        k++;
    near("samples to trip after the step", static_cast<double>(k), 33.0, 0.0);

    std::printf("ok\n");
    return 0;
}
