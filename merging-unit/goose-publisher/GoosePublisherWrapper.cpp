#include "GoosePublisherWrapper.hpp"
#include <fstream>

GoosePublisherWrapper::GoosePublisherWrapper(std::string interface,
                                             std::string goId,
                                             std::string goCbRef,
                                             uint32_t timeAllowedToLive,
                                             std::string dataSetRef,
                                             uint32_t confRev,
                                             uint8_t vlanPriority,
                                             uint16_t vlanId,
                                             uint16_t appId,
                                             std::string dstAddress)
{
    _interface = interface;
    _goId = goId;
    _goCbRef = goCbRef;
    _timeAllowedToLive = timeAllowedToLive;
    _dataSetRef = dataSetRef;
    _confRev = confRev;

    // Initialize other parameters (example)
    _commParameters.appId = appId;
    _commParameters.vlanId = vlanId;
    _commParameters.vlanPriority = vlanPriority;
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

        if (iss.fail() || (i < 5 && separator != ':') || (i == 5 && separator != '\0'))
        {
            return false; // Invalid format
        }

        macAddress[i] = static_cast<uint8_t>(byte);
    }

    return true;
}

void GoosePublisherWrapper::PublishMessage()
{
    LinkedList dataSetValues = LinkedList_create();

    // Add values to the GOOSE data set
    LinkedList_add(dataSetValues, MmsValue_newBoolean(true)); // example value
    LinkedList_add(dataSetValues, MmsValue_newBitString(23)); // example quality

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