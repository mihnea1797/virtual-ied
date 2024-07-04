#include <string>
#include <cstdint>
#include <functional>

extern "C"
{
#include <sv_subscriber.h>
}

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

public:
    SampledValuesSubscriberWrapper(std::string interface, uint16_t appId, bool destAddrCheck, double threshold);
    ~SampledValuesSubscriberWrapper();

    void Start();
    void SetListener(std::function<void()> goosePublishMessageFunction);
    void Print();
};
