extern "C"
{
#include <goose_publisher.h>
}

#include <sstream>
#include <string>
#include <iomanip>
#include <cstdint>
#include <nlohmann/json.hpp>

class GoosePublisherWrapper
{
private:
    GoosePublisher _publisher;
    CommParameters _commParameters;

    std::string _interface; //
    bool _useVlanTag;
    std::string _goId;           //
    std::string _goCbRef;        //
    uint32_t _timeAllowedToLive; //
    std::string _dataSetRef;     //
    bool _simulation;
    uint32_t _confRev; //
    bool _ndsCom;

    bool ParseMacAddress(const std::string &macStr, uint8_t macAddress[6]);
    std::string MacAddressToString(const uint8_t macAddress[6]);
    void ParseSettings(const nlohmann::json &settings);

public:
    GoosePublisherWrapper(const nlohmann::json &settings);
    ~GoosePublisherWrapper();

    void PublishMessage(bool value);
    void Print();
};
