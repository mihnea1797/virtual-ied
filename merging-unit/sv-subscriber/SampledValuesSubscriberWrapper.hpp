extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>

struct ListenerParameters
{
    double threshold;
    std::function<void()> *goosePublishMessageFunction;
};

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
    void SetListener(std::function<void()> goosePublishMessageFunction);
    void Print();
};
