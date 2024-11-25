#include "SampledValuesSubscriberWrapper.hpp"

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(const nlohmann::json &settings)
{
    ParseSettings(settings);

    _receiver = SVReceiver_create();
    SVReceiver_setInterfaceId(_receiver, const_cast<char *>(_interface.c_str()));

    _subscriber = SVSubscriber_create(NULL, _appId);

    if (_destAddrCheck)
    {
        SVReceiver_enableDestAddrCheck(_receiver);
    }
    else
    {
        SVReceiver_disableDestAddrCheck(_receiver);
    }

    SVReceiver_addSubscriber(_receiver, _subscriber);
}

SampledValuesSubscriberWrapper::~SampledValuesSubscriberWrapper()
{
    SVReceiver_stop(_receiver);
    SVReceiver_destroy(_receiver);
}

void SampledValuesSubscriberWrapper::SetListener(std::function<void(bool)> goosePublishMessageFunction)
{
    _listenerParams.goosePublishMessageFunction = &goosePublishMessageFunction;
    _listenerParams.threshold = _threshold;
    SVSubscriber_setListener(_subscriber, SvUpdateListener, &_listenerParams);
    listenerSet = true;
}

void SampledValuesSubscriberWrapper::Start()
{
    printf("Starting Listener...\n");
    if (!listenerSet)
    {
        printf("Listener not set\n");
        return;
    }

    SVReceiver_start(_receiver);

    if (!SVReceiver_isRunning(_receiver))
    {
        printf("Failed to start SV subscriber. Reason can be that the Ethernet interface doesn't exist or root permission are required.\n");
    }
}

void SampledValuesSubscriberWrapper::SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu)
{
    static RmsComputationObject rmsObject;
    double rms;

    ListenerParameters *params = static_cast<ListenerParameters *>(parameter);

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);
    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);

    if (dataSize >= 16)
    {
        int offset = 0;
        int counter = 0;
        while (offset < dataSize)
        {
            int32_t value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;

            // counter represents the number of the phase. In this example, we monitor only the third phase, processing only the
            // sample values coresponding to this phase
            if (counter == 3)
            {
                rms = rmsObject.computeValue(value);
            }

            Quality quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;

            quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            counter++;
        }

        if (params->goosePublishMessageFunction)
        {
            printf("Checking rms Value...\n");
            if (rms > params->threshold)
            {
                (*(params->goosePublishMessageFunction))(true);
            }
        }
    }
}

void SampledValuesSubscriberWrapper::Print()
{
    std::ofstream outputFile("output-sv.txt");
    if (outputFile.is_open())
    {
        outputFile << "SampledValuesSubscriberWrapper Configuration:\n";
        outputFile << "  Interface: " << _interface << "\n";
        outputFile << "  AppId: " << _appId << "\n";
        outputFile << "  DestAddrCheck: " << (_destAddrCheck ? "true" : "false") << "\n";
        outputFile << "  Threshold: " << _listenerParams.threshold << "\n";
        outputFile.close();
    }
}

void SampledValuesSubscriberWrapper::ParseSettings(const nlohmann::json &settings)
{
    _interface = settings.at("ethernetInterface").get<std::string>();
    _appId = settings.at("appId").get<uint16_t>();
    _destAddrCheck = settings.at("dstAddressCheck").get<bool>();
    _threshold = settings.at("threshold").get<double>();
}
