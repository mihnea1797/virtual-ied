#include "GoosePublisherWrapper.hpp"
#include <fstream>

GoosePublisherWrapper::GoosePublisherWrapper(const nlohmann::json &settings)
{
    ParseSettings(settings);

    // Initialize the publisher
    _publisher = GoosePublisher_create(&_commParameters, _interface.c_str());
    if (_publisher != NULL)
    {
        GoosePublisher_setGoCbRef(_publisher, const_cast<char *>(_goCbRef.c_str()));
        GoosePublisher_setGoID(_publisher, const_cast<char *>(_goId.c_str()));
        GoosePublisher_setDataSetRef(_publisher, const_cast<char *>(_dataSetRef.c_str()));
        GoosePublisher_setConfRev(_publisher, _confRev);
        GoosePublisher_setTimeAllowedToLive(_publisher, _timeAllowedToLive);
    }
}

GoosePublisherWrapper::~GoosePublisherWrapper()
{
    GoosePublisher_destroy(_publisher);
}

bool GoosePublisherWrapper::ParseMacAddress(const std::string &macStr, uint8_t macAddress[6])
{
    if (macStr.size() != 17)
    {
        return false; // Invalid MAC address length
    }

    std::istringstream iss(macStr);
    char separator;

    for (int i = 0; i < 6; ++i)
    {
        int byte;
        iss >> std::hex >> byte >> separator;

        // TODO: fix
        if (i < 5 && separator != ':')
        {
            return false; // Invalid format
        }

        macAddress[i] = static_cast<uint8_t>(byte);
    }

    return true;
}

void GoosePublisherWrapper::PublishMessage(bool value)
{
    LinkedList dataSetValues = LinkedList_create();

    // Add values to the GOOSE data set
    LinkedList_add(dataSetValues, MmsValue_newBoolean(value)); // example value
    LinkedList_add(dataSetValues, MmsValue_newBitString(23));  // example quality

    GoosePublisher_increaseStNum(_publisher);

    GoosePublisher_publish(_publisher, dataSetValues);

    LinkedList_destroyDeep(dataSetValues, (LinkedListValueDeleteFunction)MmsValue_delete);

    printf("GOOSE message published due to threshold breach\n");
}

void GoosePublisherWrapper::Print()
{
    std::ofstream outputFile("output-goose.txt");
    if (outputFile.is_open())
    {
        outputFile << "GoosePublisherWrapper Configuration:\n";
        outputFile << "  Interface: " << _interface << "\n";
        outputFile << "  GoID: " << _goId << "\n";
        outputFile << "  GoCbRef: " << _goCbRef << "\n";
        outputFile << "  TimeAllowedToLive: " << _timeAllowedToLive << "\n";
        outputFile << "  DataSetRef: " << _dataSetRef << "\n";
        outputFile << "  ConfRev: " << _confRev << "\n";
        outputFile << "  VlanPriority: " << static_cast<int>(_commParameters.vlanPriority) << "\n";
        outputFile << "  VlanId: " << _commParameters.vlanId << "\n";
        outputFile << "  AppId: " << _commParameters.appId << "\n";
        outputFile << "  DstAddress: " << GoosePublisherWrapper::MacAddressToString(_commParameters.dstAddress) << "\n";
        outputFile.close();
    }
}

std::string GoosePublisherWrapper::MacAddressToString(const uint8_t macAddress[6])
{
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (int i = 0; i < 6; ++i)
    {
        oss << std::setw(2) << static_cast<int>(macAddress[i]);
        if (i < 5)
        {
            oss << ":";
        }
    }
    return oss.str();
}

void GoosePublisherWrapper::ParseSettings(const nlohmann::json &settings)
{
    _interface = settings.at("ethernetInterface").get<std::string>();
    _goId = settings.at("goId").get<std::string>();
    _goCbRef = settings.at("goCb").get<std::string>();
    _timeAllowedToLive = settings.at("timeAllowedToLive").get<uint32_t>();
    _dataSetRef = settings.at("dataSetRef").get<std::string>();
    _confRev = settings.at("confRev").get<uint32_t>();
    _commParameters.vlanPriority = settings.at("vlanPriority").get<uint8_t>();
    _commParameters.vlanId = settings.at("vlanId").get<uint16_t>();
    _commParameters.appId = settings.at("appId").get<uint16_t>();

    std::string dstAddress = settings.at("dstAddress").get<std::string>();
    uint8_t parsedDstAddress[6];
    if (ParseMacAddress(dstAddress, parsedDstAddress))
    {
        for (int i = 0; i < 6; ++i)
        {
            _commParameters.dstAddress[i] = parsedDstAddress[i];
        }
    }
    else
    {
        // Broadcast MAC address
        for (int i = 0; i < 6; ++i)
        {
            _commParameters.dstAddress[i] = 0xFF;
        }
    }
}
