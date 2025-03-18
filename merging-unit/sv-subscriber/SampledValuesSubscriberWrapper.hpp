extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>
#include <fstream>
#include "RmsComputationObject.hpp"
#include "ButterworthFilter.hpp"

struct ListenerParameters
{
    double threshold;
    std::function<void(bool)> *goosePublishMessageFunction;
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

    static RmsComputationObject rmsObject;
    static ButterworthFilter butterFilter;
    static void SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu);
    void ParseSettings(const nlohmann::json &settings);

public:
    SampledValuesSubscriberWrapper(const nlohmann::json &settings);
    ~SampledValuesSubscriberWrapper();
    
    static void setRmsObject(const RmsComputationObject & rmsObjectReference);
    static void setButterFilter(const ButterworthFilter & butterFilterReference);
    void Start();
    void SetListener(std::function<void(bool)> goosePublishMessageFunction);
    void Print();
};
