#include "goose-publisher/GoosePublisherWrapper.hpp"
#include "sv-subscriber/SampledValuesSubscriberWrapper.hpp"
#include <memory>
#include <getopt.h>
#include <iostream>

// Function to print usage
void printUsage() {
    std::cout << "Usage: merging-unit [OPTIONS]\n"
              << "Options:\n"
              << "  --goose-interface <interface>            Set GOOSE interface\n"
              << "  --goose-goId <goId>                      Set GOOSE goId\n"
              << "  --goose-goCbRef <goCbRef>                Set GOOSE goCbRef\n"
              << "  --goose-timeAllowedToLive <time>         Set GOOSE timeAllowedToLive\n"
              << "  --goose-dataSetRef <dataSetRef>          Set GOOSE dataSetRef\n"
              << "  --goose-confRev <confRev>                Set GOOSE confRev\n"
              << "  --goose-vlanPriority <priority>          Set GOOSE vlanPriority\n"
              << "  --goose-vlanId <vlanId>                  Set GOOSE vlanId\n"
              << "  --goose-appId <appId>                    Set GOOSE appId\n"
              << "  --goose-dstAddress <dstAddress>          Set GOOSE dstAddress\n"
              << "  --sampled-values-interface <interface>   Set Sampled Values interface\n"
              << "  --sampled-values-appId <appId>           Set Sampled Values appId\n"
              << "  --sampled-values-destAddrCheck <check>   Set Sampled Values destAddrCheck\n"
              << "  --sampled-values-threshold <threshold>   Set Sampled Values threshold\n";
}

int main(int argc, char *argv[]) {
    std::string gooseInterface = "eth0";
    std::string gooseGoId = "AA1J4Q15A1LD0/LLN0.RPG";
    std::string gooseGoCbRef = "AA1J4Q15A1LD0/LLN0$GO$RPG";
    uint32_t gooseTimeAllowedToLive = 500;
    std::string gooseDataSetRef = "AA1J4Q15A1LD0/LLN0$Gss";
    uint32_t gooseConfRev = 1;
    uint8_t gooseVlanPriority = 4;
    uint16_t gooseVlanId = 0;
    uint16_t gooseAppId = 0x03;
    std::string gooseDstAddress = "01:0c:cd:01:00:00";

    std::string svInterface = "eth0";
    uint16_t svAppId = 0x4000;
    bool svDestAddrCheck = false;
    double svThreshold = 1.0;

    static struct option long_options[] = {
        {"goose-interface", required_argument, 0, 0},
        {"goose-goId", required_argument, 0, 0},
        {"goose-goCbRef", required_argument, 0, 0},
        {"goose-timeAllowedToLive", required_argument, 0, 0},
        {"goose-dataSetRef", required_argument, 0, 0},
        {"goose-confRev", required_argument, 0, 0},
        {"goose-vlanPriority", required_argument, 0, 0},
        {"goose-vlanId", required_argument, 0, 0},
        {"goose-appId", required_argument, 0, 0},
        {"goose-dstAddress", required_argument, 0, 0},
        {"sampled-values-interface", required_argument, 0, 0},
        {"sampled-values-appId", required_argument, 0, 0},
        {"sampled-values-destAddrCheck", required_argument, 0, 0},
        {"sampled-values-threshold", required_argument, 0, 0},
        {0, 0, 0, 0}
    };

    int option_index = 0;
    int c;
    while ((c = getopt_long(argc, argv, "", long_options, &option_index)) != -1) {
        switch (c) {
            case 0:
                if (optarg) {
                    std::string optName = long_options[option_index].name;
                    if (optName == "goose-interface") gooseInterface = optarg;
                    else if (optName == "goose-goId") gooseGoId = optarg;
                    else if (optName == "goose-goCbRef") gooseGoCbRef = optarg;
                    else if (optName == "goose-timeAllowedToLive") gooseTimeAllowedToLive = std::stoul(optarg);
                    else if (optName == "goose-dataSetRef") gooseDataSetRef = optarg;
                    else if (optName == "goose-confRev") gooseConfRev = std::stoul(optarg);
                    else if (optName == "goose-vlanPriority") gooseVlanPriority = std::stoul(optarg);
                    else if (optName == "goose-vlanId") gooseVlanId = std::stoul(optarg);
                    else if (optName == "goose-appId") gooseAppId = std::stoul(optarg);
                    else if (optName == "goose-dstAddress") gooseDstAddress = optarg;
                    else if (optName == "sampled-values-interface") svInterface = optarg;
                    else if (optName == "sampled-values-appId") svAppId = std::stoul(optarg);
                    else if (optName == "sampled-values-destAddrCheck") svDestAddrCheck = (std::string(optarg) == "true");
                    else if (optName == "sampled-values-threshold") svThreshold = std::stod(optarg);
                }
                break;
            default:
                break;
        }
    }

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(
        gooseInterface, gooseGoId, gooseGoCbRef, gooseTimeAllowedToLive, gooseDataSetRef,
        gooseConfRev, gooseVlanPriority, gooseVlanId, gooseAppId, gooseDstAddress);

    std::unique_ptr<SampledValuesSubscriberWrapper> sampledValuesSubscriber = std::make_unique<SampledValuesSubscriberWrapper>(
        svInterface, svAppId, svDestAddrCheck, svThreshold);

    goosePublisher->Print();
    sampledValuesSubscriber->Print();

    sampledValuesSubscriber->SetListener([&]() {
        return goosePublisher->PublishMessage();
    });
    sampledValuesSubscriber->Start();

    while (true) {
        // do nothing
    }
    return 0;
}
