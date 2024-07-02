#include "SampledValuesSubscriberWrapper.hpp"
#include <fstream>

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(std::string interface, uint16_t appId, bool destAddrCheck, double threshold)
{
    _interface = interface;
    _appId = appId;
    _destAddrCheck = destAddrCheck;
    _listenerParams.threshold = threshold;

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

void SampledValuesSubscriberWrapper::SetListener(std::function<void()> goosePublishMessageFunction)
{
    _listenerParams.goosePublishMessageFunction = &goosePublishMessageFunction;
    SVSubscriber_setListener(_subscriber, SvUpdateListener, &_listenerParams);
    listenerSet = true;
}

void SampledValuesSubscriberWrapper::Start()
{
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
    // if (!running)
    //     return;

    ListenerParameters *params = static_cast<ListenerParameters *>(parameter);

    printf("svUpdateListener called\n");

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);

    if (svID != NULL)
        printf("  svID=(%s)\n", svID);

    printf("  smpCnt: %i\n", SVSubscriber_ASDU_getSmpCnt(asdu));
    printf("  confRev: %u\n", SVSubscriber_ASDU_getConfRev(asdu));
    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);
    printf("  dataSize: %i\n", SVSubscriber_ASDU_getDataSize(asdu));

    if (dataSize >= 16)
    {
        int offset = 0;
        int counter = 0;
        while (offset < dataSize)
        {
            int32_t value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;
            double current = value / (1000 * 1.41);
            printf("   Current[%d]: %lf\n", counter, current);
            Quality quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
            printf("   Quality_Current[%d]: %u\n", counter, quality);

            value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;
            double voltage = value / 1.41;
            printf("   Voltage[%d]: %lf\n", counter, voltage);
            quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
            printf("   Quality_Voltage[%d]: %u\n", counter, quality);
            counter++;

            printf("   Threshold: %lf\n", params->threshold);
            if (voltage > params->threshold && params->goosePublishMessageFunction)
            {
                (*(params->goosePublishMessageFunction))();
            }
        }
    }
    else
    {
        printf("   Data size too small to contain FLOAT32 values\n");
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