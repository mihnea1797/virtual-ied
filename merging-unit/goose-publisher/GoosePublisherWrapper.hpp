extern "C"
{
#include <goose_publisher.h>
#include <r_session.h>
}

#include <sstream>
#include <string>
#include <iomanip>
#include <cstdint>
#include <vector>
#include <nlohmann/json.hpp>

struct GooseRSessionKey
{
    int id;
    std::string key;
    std::string secAlgo;
    std::string sigAlgo;
};

class GoosePublisherWrapper
{
private:
    GoosePublisher _publisher;
    RSession _rSession;

    std::string _goId;
    std::string _goCbRef;
    uint32_t _timeAllowedToLive;
    std::string _dataSetRef;
    bool _simulation;
    uint32_t _confRev;
    bool _ndsCom;
    uint16_t _appId;

    std::string _remoteAddress;
    int _remotePort;
    std::string _localAddress;
    int _localPort;
    int _activeKeyId;
    std::vector<GooseRSessionKey> _keys;

    void ParseSettings(const nlohmann::json &settings);

public:
    GoosePublisherWrapper(const nlohmann::json &settings);
    ~GoosePublisherWrapper();

    void PublishMessage(bool value);
    void Print();
};
