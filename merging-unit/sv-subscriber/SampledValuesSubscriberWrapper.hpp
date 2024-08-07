extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>

// value used for scaling the sampled values received from ISA
#define SCALING_CONSTANT ((_Float64)537401.187777)

// number of sample values per signal period
#define SAMPLES_PER_PERIOD ((uint8_t)80)

struct ListenerParameters
{
    double threshold;
    std::function<void(bool)> *goosePublishMessageFunction;
};

inline double RMS_computation(int32_t value, double RMS_prev);

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
