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

// Enum describing the possible formats of SV data
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
    uint16_t appId;
    double voltageThreshold;
    double currentThreshold;
    std::function<void(bool)> *goosePublishMessageFunction;
};

struct RSessionKey
{
    int id;
    std::string key;
    std::string secAlgo;
    std::string sigAlgo;
};

class SampledValuesSubscriberWrapper
{
private:
    SVReceiver _receiver;
    SVSubscriber _subscriber;
    RSession _rSession = nullptr;

    std::string _interface;
    uint16_t _appId;
    bool _destAddrCheck;
    double _voltageThreshold;
    double _currentThreshold;

    std::string _localAddress;
    int _port;
    std::vector<std::string> _multicastGroups;
    std::vector<RSessionKey> _keys;

    bool listenerSet = false;
    ListenerParameters _listenerParams;

    void ParseSettings(const nlohmann::json &settings);

    // Static attributes used inside of SvUpdateListener()
    static std::vector<RmsComputationObject> voltageRmsObject;
    static std::vector<RmsComputationObject> currentRmsObject;
    
    static std::vector<ButterworthFilter> voltageButterFilter;
    static std::vector<ButterworthFilter> currentButterFilter;

    static std::vector<FrequencyTracking> voltageFrequencyTracker;
    static std::vector<FrequencyTracking> currentFrequencyTracker;

    static DataFormat format;
    static uint8_t numberOfPhases;

    static std::unique_ptr<pqxx::connection> dbConn_;

    // Helper functions used for static members population
    static std::string ParsePostgresSQL(const nlohmann::json &postgresSqlPorperties);
    static bool parseSVData(std::vector<int32_t> &voltageMeasurements, std::vector<int32_t> &currentMeasurements, const SVSubscriber_ASDU &asdu);

    // Helper function used for writing data to DataBase inside of SvUpdateListener()
    static void storeRMSinDatabase(uint16_t appId, uint32_t index, double rms, const std::string & measurement);

    // Callback function executed after an SV has been received
    static void SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu);

public:
    SampledValuesSubscriberWrapper(const nlohmann::json &sampleValuesSettings);
    ~SampledValuesSubscriberWrapper();
    
    // Setters for the static attributes
    static void setVoltageRmsObject(const nlohmann::json & signalProperties);
    static void setCurrentRmsObject(const nlohmann::json & signalProperties);
    static void setVoltageButterFilter(const nlohmann::json & filterProperties);
    static void setCurrentButterFilter(const nlohmann::json & filterProperties);
    static void setVoltageFrequencyTracker();
    static void setCurrentFrequencyTracker();
    static void setDataFormat(const nlohmann::json & dataFormat);
    static void setPostgresConnection(const nlohmann::json &postgresSqlProperties);

    // Getters for the static attributes
    static uint8_t getNumberOfPhases();
    static DataFormat getDataFormat();

    void Start();
    void SetListener(std::function<void(bool)> goosePublishMessageFunction);
    void Print();
};
