extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>

using namespace std;

// value used for scaling the sampled values received from ISA
#define SCALING_CONSTANT ((_Float64)537401.187777)

// the value mentioned above squared
#define SCALING_CONSTANT_SQUARED (((_Float128)537401.187777) * ((_Float128)537401.187777))

// square root of 2
#define SQRT2 (double(sqrt(2)))

// number of sample values per signal period
#define SAMPLES_PER_PERIOD ((uint8_t)80)

struct ListenerParameters
{
    double threshold;
    std::function<void(bool)> *goosePublishMessageFunction;
};

inline double RMS_computation(const int32_t & value, __uint128_t & PREVIOUS_INTERMEDIAR_VALUE_UNSCALED, uint8_t & Sample_Number, __uint128_t  & AUX_RMS_UNSCALED, uint64_t * prev_val);

class SampledValuesSubscriberWrapper
{
private:
    SVReceiver _receiver;
    SVSubscriber _subscriber;

    std::string _interface;
    uint16_t _appId;
    bool _destAddrCheck;
    double _threshold;

    bool listenerSet = false;
    ListenerParameters _listenerParams;

    static void SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu);
    void ParseSettings(const nlohmann::json &settings);

public:
    SampledValuesSubscriberWrapper(const nlohmann::json &settings);
    ~SampledValuesSubscriberWrapper();

    void Start();
    void SetListener(std::function<void(bool)> goosePublishMessageFunction);
    void Print();
};
