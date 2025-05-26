extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>
#include <fstream>
#include <vector>
#include "RmsComputationObject.hpp"
#include "ButterworthFilter.hpp"
#include "FrequencyTracking.hpp"
#include <pqxx/pqxx>

// Macro used for defining the number of phases
#define NUMBER_OF_PHASES ((uint32_t)3)

enum class DataFormat
{
    onlyV,
    onlyI,
    clusterVI,
    clusterIV,
    pairVI,
    pairIV
};

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

    std::unique_ptr<pqxx::connection> dbConn_;

    static std::vector<RmsComputationObject> rmsObject;
    static std::vector<ButterworthFilter> butterFilter;
    static std::vector<FrequencyTracking> frequencyTracker;

    static DataFormat format;
    static bool parseSVData(std::vector<int32_t> &voltageMeasurements, std::vector<int32_t> &currentMeasurements, const SVSubscriber_ASDU &asdu);
    static void SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu);
    void ParseSettings(const nlohmann::json &settings);
    void ParsePostgresSQL(const nlohmann::json &postgresSqlPorperties);
    
public:
    SampledValuesSubscriberWrapper(const nlohmann::json &sampleValuesSettings, const nlohmann::json &postgresSqlPorperties);
    ~SampledValuesSubscriberWrapper();

    static void setRmsObject(const nlohmann::json &signalProperties);
    static void setButterFilter(const nlohmann::json &filterProperties);
    static void setFrequencyTracker();
    static void setDataFormat(const nlohmann::json &dataFormat);
    void Start();
    void SetListener(std::function<void(bool)> goosePublishMessageFunction);
    void Print();
};
