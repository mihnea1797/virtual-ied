#include "goose-publisher/GoosePublisherWrapper.hpp"
#include "sv-subscriber/SampledValuesSubscriberWrapper.hpp"
#include "ButterworthFilter.hpp"
#include "RmsComputationObject.hpp"
#include <memory>
#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>

int main()
{
    std::ifstream file("/opt/virtual-merging-unit/config.json");
    if (!file)
    {
        std::cerr << "Unable to open config file." << std::endl;
        return 1;
    }

    nlohmann::json config;
    file >> config;

    nlohmann::json gooseSettings = config["gooseSettings"];
    nlohmann::json sampledValuesSettings = config["sampledValuesSettings"];
    nlohmann::json voltageSignalProperties = config["voltageSignalProperties"];
    nlohmann::json currentSignalProperties = config["currentSignalProperties"];
    nlohmann::json voltageFilterProperties = config["voltageFilterProperties"];
    nlohmann::json currentFilterProperties = config["currentFilterProperties"];
    nlohmann::json dataFormat = config["dataFormat"];
    nlohmann::json postgresSqlProperties = config["postgresSql"];

    SampledValuesSubscriberWrapper::setDataFormat(dataFormat);

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(gooseSettings);
    std::unique_ptr<SampledValuesSubscriberWrapper> sampledValuesSubscriber = std::make_unique<SampledValuesSubscriberWrapper>(sampledValuesSettings); 
    SampledValuesSubscriberWrapper::setDataFormat(dataFormat);
    SampledValuesSubscriberWrapper::setPostgresConnection(postgresSqlProperties);
    
    for(uint32_t index = 0; index < SampledValuesSubscriberWrapper::getNumberOfPhases(); index++)
    {
        if(SampledValuesSubscriberWrapper::getDataFormat() != DataFormat::onlyI)
        {
            SampledValuesSubscriberWrapper::setVoltageRmsObject(voltageSignalProperties);
            SampledValuesSubscriberWrapper::setVoltageButterFilter(voltageFilterProperties);
            SampledValuesSubscriberWrapper::setVoltageFrequencyTracker();
        }
        
        if(SampledValuesSubscriberWrapper::getDataFormat() != DataFormat::onlyV)
        {
            SampledValuesSubscriberWrapper::setCurrentRmsObject(currentSignalProperties);
            SampledValuesSubscriberWrapper::setCurrentButterFilter(currentFilterProperties);
            SampledValuesSubscriberWrapper::setCurrentFrequencyTracker();
        }
    }

    goosePublisher->Print();
    sampledValuesSubscriber->Print();

    sampledValuesSubscriber->SetListener([&](bool value)
                                         { return goosePublisher->PublishMessage(value); });
    sampledValuesSubscriber->Start();

    while (true)
    {
        // do nothing
    }

    return 0;
}
