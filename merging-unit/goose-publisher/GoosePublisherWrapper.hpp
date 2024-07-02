extern "C"
{
#include "goose_publisher.h"
}

#include <sstream>
#include <string>
#include <iomanip>
#include <cstdint>

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

public:
    GoosePublisherWrapper(std::string interface,
                          std::string goId,
                          std::string goCbRef,
                          uint32_t timeAllowedToLive,
                          std::string dataSetRef,
                          uint32_t confRev,
                          uint8_t vlanPriority,
                          uint16_t vlanId,
                          uint16_t appId,
                          std::string dstAddress);
    ~GoosePublisherWrapper();

    void PublishMessage();
};
